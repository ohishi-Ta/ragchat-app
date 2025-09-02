import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'ap-northeast-1' });
const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME;
const URL_EXPIRATION = 3600; // 1時間

const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf'
];

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB制限

// JWTトークンからユーザーIDを抽出
function extractUserIdFromToken(token) {
    try {
        if (token.startsWith('Bearer ')) {
            token = token.substring(7);
        }
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        
        const payload = parts[1];
        const decoded = Buffer.from(payload, 'base64').toString('utf-8');
        const claims = JSON.parse(decoded);
        
        if (claims.exp && claims.exp < Date.now() / 1000) {
            return null;
        }
        
        return claims.sub;
    } catch (error) {
        console.error('Token decode failed:', error);
        return null;
    }
}

export const handler = async (event) => {
    console.log('Presigned URL request:', JSON.stringify(event));
    
    try {
        const httpMethod = event.requestContext?.http?.method || event.httpMethod;
        
        if (httpMethod === 'OPTIONS') {
            return {
                statusCode: 200,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                },
                body: ''
            };
        }

        // 認証チェック
        const authHeader = event.headers?.authorization || event.headers?.Authorization || '';
        const userId = extractUserIdFromToken(authHeader);
        
        if (!userId) {
            return {
                statusCode: 401,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ error: 'Unauthorized' })
            };
        }
        
        const body = JSON.parse(event.body);
        const { fileName, fileType, fileSize } = body;
        
        // 必須フィールドの検証
        if (!fileName || !fileType) {
            return {
                statusCode: 400,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ error: 'Missing required fields: fileName and fileType' })
            };
        }
        
        // ファイルタイプのバリデーション
        if (!ALLOWED_FILE_TYPES.includes(fileType)) {
            return {
                statusCode: 400,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ error: `Invalid file type. Allowed types: ${ALLOWED_FILE_TYPES.join(', ')}` })
            };
        }
        
        // ファイルサイズの検証
        if (fileSize && fileSize > MAX_FILE_SIZE) {
            return {
                statusCode: 400,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ error: `File size exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB` })
            };
        }
        
        // S3キーを生成（ユーザーIDと日時でユニークに）
        const timestamp = Date.now();
        const randomId = Math.random().toString(36).substring(2, 15);
        const cleanFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
        const s3Key = `uploads/${userId}/${timestamp}-${randomId}-${cleanFileName}`;
        
        console.log('Generating presigned URL for:', s3Key);
        
        // Presigned URLを生成
        const command = new PutObjectCommand({
            Bucket: S3_BUCKET_NAME,
            Key: s3Key,
            ContentType: fileType,
            // メタデータを追加
            Metadata: {
                'original-filename': fileName,
                'uploaded-by': userId,
                'upload-timestamp': timestamp.toString()
            }
        });
        
        const uploadUrl = await getSignedUrl(s3Client, command, { 
            expiresIn: URL_EXPIRATION
        });
        
        // 有効期限の計算
        const expiresAt = Date.now() + (URL_EXPIRATION * 1000);
        
        console.log('Presigned URL generated successfully:', {
            userId,
            fileName,
            fileType,
            s3Key,
            expiresAt: new Date(expiresAt).toISOString()
        });
        
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                uploadUrl,
                s3Key,
                expiresIn: URL_EXPIRATION,
                expiresAt,
                method: 'PUT',
                headers: {
                    'Content-Type': fileType
                }
            })
        };
        
    } catch (error) {
        console.error('Error generating presigned URL:', error);
        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};