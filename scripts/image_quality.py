"""Local image quality inspection used by the Journey image downloader.

This is deliberately a small, deterministic computer-vision stage: Pillow
decodes the file, OpenCV calculates Laplacian sharpness, MSER finds
text-shaped regions, QRCodeDetector checks QR codes, and perceptual hashes
support cross-query de-duplication. It never removes pixels or watermarks.
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image


def phash(gray: np.ndarray) -> str:
    small = cv2.resize(gray, (32, 32), interpolation=cv2.INTER_AREA).astype(np.float32)
    coefficients = cv2.dct(small)[:8, :8]
    values = coefficients.flatten()
    threshold = float(np.median(values[1:]))
    bits = (values > threshold).astype(np.uint8)
    return "".join(f"{int(bits[index:index + 4].dot(np.array([8, 4, 2, 1], dtype=np.uint8))):x}" for index in range(0, 64, 4))


def dhash(gray: np.ndarray) -> str:
    small = cv2.resize(gray, (9, 8), interpolation=cv2.INTER_AREA)
    bits = (small[:, 1:] > small[:, :-1]).flatten().astype(np.uint8)
    return "".join(f"{int(bits[index:index + 4].dot(np.array([8, 4, 2, 1], dtype=np.uint8))):x}" for index in range(0, 64, 4))


def iou(a: tuple[int, int, int, int], b: tuple[int, int, int, int]) -> float:
    ax, ay, aw, ah = a
    bx, by, bw, bh = b
    left, top = max(ax, bx), max(ay, by)
    right, bottom = min(ax + aw, bx + bw), min(ay + ah, by + bh)
    intersection = max(0, right - left) * max(0, bottom - top)
    union = aw * ah + bw * bh - intersection
    return intersection / union if union else 0.0


def text_regions(gray: np.ndarray) -> tuple[float, int, list[tuple[int, int, int, int]]]:
    height, width = gray.shape[:2]
    image_area = float(width * height)
    try:
        detector = cv2.MSER_create(5, 30, max(120, int(image_area * 0.08)))
        _, raw_boxes = detector.detectRegions(gray)
    except Exception:
        raw_boxes = []
    boxes: list[tuple[int, int, int, int]] = []
    for raw in raw_boxes:
        x, y, w, h = map(int, raw)
        area = w * h
        if w < 5 or h < 5 or area < 30 or area > image_area * 0.02 or h > height * 0.12 or w > width * 0.45:
            continue
        ratio = w / max(h, 1)
        if ratio > 18 or ratio < 0.08:
            continue
        if any(iou((x, y, w, h), existing) > 0.55 for existing in boxes):
            continue
        boxes.append((x, y, w, h))
    # MSER gives character-sized boxes. Merge nearby boxes into line regions so
    # text-heavy cards and screenshots are measured by occupied area, not glyph count.
    mask = np.zeros_like(gray, dtype=np.uint8)
    for x, y, w, h in boxes:
        cv2.rectangle(mask, (x, y), (x + w, y + h), 255, -1)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (max(3, width // 140), max(3, height // 140)))
    merged = cv2.dilate(mask, kernel, iterations=2)
    contours, _ = cv2.findContours(merged, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    line_boxes: list[tuple[int, int, int, int]] = []
    for contour in contours:
        x, y, w, h = cv2.boundingRect(contour)
        if w * h >= image_area * 0.00015 and w >= 10 and h >= 6:
            line_boxes.append((x, y, w, h))
    occupied = float(cv2.countNonZero(merged)) / image_area
    return min(1.0, occupied), len(line_boxes), line_boxes


def collage_likelihood(gray: np.ndarray) -> bool:
    height, width = gray.shape[:2]
    edges = cv2.Canny(gray, 80, 180)
    lines = cv2.HoughLinesP(edges, 1, np.pi / 180, threshold=max(80, min(width, height) // 5), minLineLength=max(80, min(width, height) // 3), maxLineGap=12)
    vertical = 0
    horizontal = 0
    for line in lines if lines is not None else []:
        values = np.asarray(line).reshape(-1)
        if values.size < 4:
            continue
        x1, y1, x2, y2 = map(int, values[:4])
        dx, dy = abs(x2 - x1), abs(y2 - y1)
        if dx <= max(3, width // 200) and dy > height * 0.35:
            vertical += 1
        elif dy <= max(3, height // 200) and dx > width * 0.35:
            horizontal += 1
    return vertical >= 2 and horizontal >= 1


def black_border_ratio(gray: np.ndarray) -> float:
    height, width = gray.shape[:2]
    band_x, band_y = max(2, width // 100), max(2, height // 100)
    bands = (gray[:, :band_x], gray[:, -band_x:], gray[:band_y, :], gray[-band_y:, :])
    dark_uniform = [float(np.mean(band) < 28 and np.std(band) < 24) for band in bands]
    ratio = 0.0
    if dark_uniform[0] and dark_uniform[1]:
        ratio = max(ratio, 2 * band_x / width)
    if dark_uniform[2] and dark_uniform[3]:
        ratio = max(ratio, 2 * band_y / height)
    return ratio


def centered_watermark_likelihood(boxes: list[tuple[int, int, int, int]], width: int, height: int, text_ratio: float) -> bool:
    """Catch large creator/platform marks that are not located in a corner."""
    # Dense text in the scene itself is commonly a shop sign, museum label or
    # food packaging. Treat the centered pattern as an overlay only when the
    # text is sparse enough to look like a creator mark.
    if text_ratio > 0.18:
        return False
    for x, y, w, h in boxes:
        center_x, center_y = x + w / 2, y + h / 2
        if (
            width * 0.2 < center_x < width * 0.8
            and height * 0.2 < center_y < height * 0.8
            and w >= width * 0.22
            and h >= height * 0.06
        ):
            return True
    return False


def signage_score(decoded: np.ndarray) -> float:
    height, width = decoded.shape[:2]
    image_area = float(width * height)
    hsv = cv2.cvtColor(decoded, cv2.COLOR_BGR2HSV)
    blue = cv2.inRange(hsv, np.array([95, 80, 45]), np.array([140, 255, 255]))
    contours, _ = cv2.findContours(blue, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    best = 0.0
    for contour in contours:
        x, y, w, h = cv2.boundingRect(contour)
        area = w * h
        ratio = w / max(h, 1)
        rectangularity = cv2.contourArea(contour) / max(area, 1)
        if area < image_area * 0.025 or ratio < 2.0 or ratio > 12.0 or rectangularity < 0.55:
            continue
        region = hsv[y:y + h, x:x + w]
        white = cv2.inRange(region, np.array([0, 0, 150]), np.array([179, 90, 255]))
        white_ratio = float(cv2.countNonZero(white)) / max(area, 1)
        score = min(1.0, area / image_area * 4) * min(1.0, white_ratio * 5)
        best = max(best, score)
    return best


def inspect(path: Path) -> dict[str, object]:
    with Image.open(path) as image:
        width, height = image.size
    raw = np.fromfile(str(path), dtype=np.uint8)
    decoded = cv2.imdecode(raw, cv2.IMREAD_COLOR)
    if decoded is None:
        raise ValueError("OpenCV could not decode image")
    # Keep the downloaded original untouched, but cap the analysis image so a
    # very large search result cannot monopolize the batch on MSER/Hough work.
    analysis_image = decoded
    analysis_height, analysis_width = analysis_image.shape[:2]
    scale = min(1.0, 1600.0 / max(analysis_width, analysis_height))
    if scale < 1.0:
        analysis_image = cv2.resize(analysis_image, (max(1, round(analysis_width * scale)), max(1, round(analysis_height * scale))), interpolation=cv2.INTER_AREA)
    analysis_height, analysis_width = analysis_image.shape[:2]
    gray = cv2.cvtColor(analysis_image, cv2.COLOR_BGR2GRAY)
    sharpness = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    # Keep the score on the same 0..100 scale used by the TypeScript ranker.
    sharpness_score = max(0.0, min(100.0, math.log1p(sharpness) / math.log1p(1600) * 100))
    text_ratio, text_count, boxes = text_regions(gray)
    qr_detector = cv2.QRCodeDetector()
    qr_found = False
    try:
        qr_found, _ = qr_detector.detect(analysis_image)
        qr_found = bool(qr_found)
    except Exception:
        qr_found = False
    if not qr_found:
        try:
            ok, _, _ = qr_detector.detectAndDecodeMulti(analysis_image)
            qr_found = bool(ok)
        except Exception:
            qr_found = False
    corner_area = 0.0
    for x, y, w, h in boxes:
        near_corner = (x < analysis_width * 0.2 or x + w > analysis_width * 0.8) and (y < analysis_height * 0.2 or y + h > analysis_height * 0.8)
        if near_corner:
            corner_area += w * h
    watermark_score = min(1.0, corner_area / max(analysis_width * analysis_height, 1) * 10)
    has_watermark = (
        (text_ratio < 0.08 and watermark_score >= 0.025 and len(boxes) >= 3)
        or centered_watermark_likelihood(boxes, analysis_width, analysis_height, text_ratio)
    )
    # A screenshot is rejected only when screen-like text density or a large
    # uniform UI border accompanies a common device aspect ratio; ordinary
    # portrait photos are not rejected here.
    aspect = width / max(height, 1)
    screen_ratio = any(abs(aspect - candidate) < 0.035 for candidate in (9 / 16, 16 / 9, 9 / 19.5, 19.5 / 9, 3 / 4, 4 / 3))
    band_x, band_y = max(4, analysis_width // 35), max(4, analysis_height // 35)
    edge_bands = (gray[:, :band_x], gray[:, -band_x:], gray[:band_y, :], gray[-band_y:, :])
    uniform_ui_border = sum(float(np.mean(band) < 18 and np.std(band) < 12) for band in edge_bands) >= 2
    is_screenshot = screen_ratio and (text_ratio > 0.65 or (text_ratio > 0.42 and text_count >= 100) or (uniform_ui_border and text_ratio > 0.22))
    black_border = black_border_ratio(gray)
    signage = signage_score(analysis_image)
    return {
        "width": width,
        "height": height,
        "fileSize": path.stat().st_size,
        "sharpness": sharpness,
        "sharpnessScore": round(sharpness_score, 2),
        "textAreaRatio": round(text_ratio, 5),
        "textRegionCount": text_count,
        "ocrTextAreaDetector": "opencv-mser",
        "hasOverlayText": text_ratio > 0.65 or (text_ratio > 0.25 and text_count >= 100),
        "hasQrCode": qr_found,
        "watermarkScore": round(watermark_score, 5),
        "hasWatermark": has_watermark,
        "isScreenshot": is_screenshot,
        "isCollage": collage_likelihood(gray),
        "blackBorderRatio": round(black_border, 5),
        "hasBlackBorder": black_border >= 0.012,
        "signageScore": round(signage, 5),
        "isSignage": signage >= 0.08,
        "pHash": phash(gray),
        "dHash": dhash(gray),
        "visionEngine": f"Pillow {Image.__version__} + OpenCV {cv2.__version__}",
    }


def main() -> int:
    if len(sys.argv) != 2:
        print(json.dumps({"error": "usage: image_quality.py IMAGE_PATH"}, ensure_ascii=False))
        return 2
    try:
        print(json.dumps(inspect(Path(sys.argv[1])), ensure_ascii=False))
        return 0
    except Exception as error:
        print(json.dumps({"error": str(error)}, ensure_ascii=False))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
