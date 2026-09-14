import { handleCloudRequest, type CloudEnv } from '../../server/cloud/handler'
export const onRequest = (context:{request:Request;env:CloudEnv}) => handleCloudRequest(context.request,context.env)
