import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { BedrockRuntimeClient, ConverseStreamCommand } from "@aws-sdk/client-bedrock-runtime";
import { BedrockAgentRuntimeClient, RetrieveCommand } from "@aws-sdk/client-bedrock-agent-runtime";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

// AWSクライアントの初期化
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const dynamodb = DynamoDBDocumentClient.from(dynamoClient);
const bedrockRuntime = new BedrockRuntimeClient({ region: process.env.BEDROCK_AWS_REGION });
const bedrockAgentRuntime = new BedrockAgentRuntimeClient({ region: process.env.KB_AWS_REGION });
const s3Client = new S3Client({ region: process.env.AWS_REGION });

// 環境変数
const CHAT_TABLE_NAME = process.env.DYNAMODB_TABLE_NAME;
const KNOWLEDGE_BASE_ID = process.env.KNOWLEDGE_BASE_ID;
const BEDROCK_AWS_REGION = process.env.BEDROCK_AWS_REGION;
const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME;

// モデルマッピング
const MODEL_MAPPING = {
    'nova-lite': 'us.amazon.nova-lite-v1:0',
    'nova-pro': 'us.amazon.nova-pro-v1:0',
    'claude-3-7-sonnet': 'us.anthropic.claude-3-7-sonnet-20250219-v1:0',
    'claude-sonnet-4': 'us.anthropic.claude-sonnet-4-20250514-v1:0',
    'gpt-oss-20b': 'openai.gpt-oss-20b-1:0',
    'gpt-oss-120b': 'openai.gpt-oss-120b-1:0',
};

// S3から画像を読み込み、Bedrock形式に変換
async function loadImageFromS3(s3Key, fileType) {
    try {
        console.log(`[DEBUG] S3から画像を読み込み: ${s3Key}`);
        
        const getObjectCommand = new GetObjectCommand({
            Bucket: S3_BUCKET_NAME,
            Key: s3Key
        });
        
        const response = await s3Client.send(getObjectCommand);
        const imageBytes = await response.Body.transformToByteArray();
        
        // ファイルタイプから画像フォーマットを抽出
        const imageFormat = fileType.replace('image/', '');
        
        console.log(`[DEBUG] S3画像読み込み成功: ${s3Key}, サイズ: ${imageBytes.length} bytes`);
        
        // Bedrock制限チェック
        const MAX_IMAGE_SIZE = 3.75 * 1024 * 1024; // 3.75MB
        if (imageBytes.length > MAX_IMAGE_SIZE) {
            const errorMsg = `画像サイズがBedrock制限(3.75MB)を超過: ${imageBytes.length} bytes > ${MAX_IMAGE_SIZE} bytes`;
            console.error(`[ERROR] ${errorMsg}`);
            throw new Error(errorMsg);
        }
        
        return {
            image: {
                format: imageFormat,
                source: {
                    bytes: imageBytes
                }
            }
        };
    } catch (error) {
        console.error(`[ERROR] S3画像読み込みエラー (${s3Key}):`, error);
        throw new Error(`画像の読み込みに失敗しました: ${error.message}`);
    }
}

// 不要な関数を削除しました

// S3からPDFを読み込み、Bedrock形式に変換
async function loadDocumentFromS3(s3Key, fileName) {
    try {
        console.log(`[DEBUG] S3からPDFを読み込み: ${s3Key}`);
        
        const getObjectCommand = new GetObjectCommand({
            Bucket: S3_BUCKET_NAME,
            Key: s3Key
        });
        
        const response = await s3Client.send(getObjectCommand);
        const pdfBytes = await response.Body.transformToByteArray();
        
        console.log(`[DEBUG] S3 PDF読み込み成功: ${s3Key}, サイズ: ${pdfBytes.length} bytes`);
        
        // PDF用の制限チェック  
        const MAX_PDF_SIZE = 3.75 * 1024 * 1024; // 3.75MB
        if (pdfBytes.length > MAX_PDF_SIZE) {
            const errorMsg = `PDFサイズがBedrock制限(3.75MB)を超過: ${pdfBytes.length} bytes > ${MAX_PDF_SIZE} bytes`;
            console.error(`[ERROR] ${errorMsg}`);
            throw new Error(errorMsg);
        }
        
        return {
            document: {
                format: 'pdf',
                name: 'doc',
                source: {
                    bytes: pdfBytes
                }
            }
        };
    } catch (error) {
        console.error(`[ERROR] S3 PDF読み込みエラー (${s3Key}):`, error);
        throw new Error(`PDFの読み込みに失敗しました: ${error.message}`);
    }
}

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
            console.warn('Token expired');
            return null;
        }
        
        return claims.sub;
    } catch (error) {
        console.error('Token decode failed:', error);
        return null;
    }
}

// SSEイベントのフォーマット
function formatSSEEvent(eventType, data) {
    if (eventType === 'message') {
        const jsonData = JSON.stringify({ type: 'message', data: data });
        return `data: ${jsonData}\n\n`;
    } else {
        const jsonData = JSON.stringify(data);
        return `event: ${eventType}\ndata: ${jsonData}\n\n`;
    }
}

// エラーレスポンスを送信
function sendErrorResponse(responseStream, message) {
    responseStream.write(formatSSEEvent('error', message));
    responseStream.write(formatSSEEvent('end', 'Stream ended'));
    responseStream.end();
}

// DynamoDB履歴をConverse API形式に変換
function convertDynamoToConverseMessages(dynamoMessages) {
    return dynamoMessages.map(msg => {
        const content = [];
        
        // テキストコンテンツを追加
        if (msg.content) {
            content.push({ text: msg.content });
        }
        
        // 添付ファイル処理（ユーザーメッセージのみ）
        if (msg.role === 'user' && msg.attachment?.data) {
            if (msg.attachment.fileType?.startsWith('image/')) {
                content.push({
                    image: {
                        format: msg.attachment.fileType.split('/')[1], // "image/jpeg" → "jpeg"
                        source: {
                            bytes: Buffer.from(msg.attachment.data, 'base64')
                        }
                    }
                });
            } else if (msg.attachment.fileType === 'application/pdf') {
                content.push({
                    document: {
                        format: 'pdf',
                        name: 'doc',
                        source: {
                            bytes: Buffer.from(msg.attachment.data, 'base64')
                        }
                    }
                });
            }
        }
        
        return {
            role: msg.role,
            content: content
        };
    });
}

// 履歴制限関数
function limitHistoryMessages(messages, maxMessages = 10) {
    if (messages.length <= maxMessages) {
        return messages;
    }
    
    const limitedMessages = messages.slice(-maxMessages);
    
    if (limitedMessages[0]?.role === 'assistant' && messages.length > maxMessages) {
        const prevUserIndex = messages.findIndex(m => m.id === limitedMessages[0].id) - 1;
        if (prevUserIndex >= 0 && messages[prevUserIndex]?.role === 'user') {
            limitedMessages.unshift(messages[prevUserIndex]);
        }
    }
    
    return limitedMessages;
}

// 履歴取得関数
async function getChatHistory(chatId, userId) {
    if (!chatId) return [];
    
    try {
        const getCommand = new GetCommand({
            TableName: CHAT_TABLE_NAME,
            Key: { userId }
        });
        const dbResponse = await dynamodb.send(getCommand);
        const allChats = dbResponse.Item?.chats || [];
        
        const currentChat = allChats.find(chat => chat.id === chatId);
        if (currentChat?.messages) {
            const limitedHistory = limitHistoryMessages(currentChat.messages, 10);
            return convertDynamoToConverseMessages(limitedHistory);
        }
    } catch (error) {
        console.error('[ERROR] 履歴取得エラー:', error);
    }
    
    return [];
}

// Lambda Response Streaming ハンドラー
export const handler = awslambda.streamifyResponse(async (event, responseStream, context) => {
    console.log('[DEBUG] Request received');
    
    responseStream = awslambda.HttpResponseStream.from(responseStream, {
        statusCode: 200,
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        }
    });
    
    try {
        const httpMethod = event.requestContext?.http?.method || event.httpMethod;
        
        if (httpMethod === 'OPTIONS') {
            responseStream.end();
            return;
        }
        
        if (httpMethod === 'GET') {
            responseStream.write('<h1>Lambda Function with Response Streaming is working!</h1>');
            responseStream.end();
            return;
        }
        
        if (httpMethod === 'POST') {
            try {
                // 認証処理
                const authHeader = event.headers?.authorization || event.headers?.Authorization || '';
                const userId = extractUserIdFromToken(authHeader);
                
                if (!userId) {
                    console.log('[DEBUG] 認証失敗');
                    sendErrorResponse(responseStream, 'Unauthorized');
                    return;
                }
                
                // リクエストボディの解析
                let body = {};
                if (event.body) {
                    try {
                        body = event.isBase64Encoded 
                            ? JSON.parse(Buffer.from(event.body, 'base64').toString('utf-8'))
                            : JSON.parse(event.body);
                    } catch (parseError) {
                        console.error('[ERROR] JSON解析エラー:', parseError);
                        sendErrorResponse(responseStream, 'Invalid JSON in request body');
                        return;
                    }
                }
                
                const userPrompt = body.user_prompt || '';
                const chatId = body.chat_id;
                let mode = body.mode || 'knowledge_base';
                let modelKey = body.model || 'nova-lite';
                const attachment = body.attachment;
                const userMessageId = body.user_message_id;
                const assistantMessageId = body.assistant_message_id;
                
                
                if (!userMessageId || !assistantMessageId) {
                    console.error('[ERROR] メッセージIDが不足');
                    sendErrorResponse(responseStream, 'Message IDs are required');
                    return;
                }
                
                if (!userPrompt && !attachment) {
                    console.log('[DEBUG] プロンプトと添付ファイルが両方なし');
                    sendErrorResponse(responseStream, 'user_prompt or attachment is required');
                    return;
                }
                
                const historyMessages = await getChatHistory(chatId, userId);
                
                // 添付ファイル処理
                let processedAttachment = null;
                if (attachment) {
                    mode = 'general';
                    
                    // S3アップロードファイルの場合
                    if (attachment.s3Key) {
                        console.log('[DEBUG] S3アップロードファイルを処理:', attachment.s3Key);
                        
                        if (attachment.source?.media_type?.startsWith('image/')) {
                            try {
                                processedAttachment = await loadImageFromS3(attachment.s3Key, attachment.source.media_type);
                            } catch (error) {
                                console.error('[ERROR] S3画像読み込み失敗:', error);
                                responseStream.write(formatSSEEvent('error', `画像の読み込みに失敗しました: ${error.message}`));
                                responseStream.write(formatSSEEvent('end', 'Stream ended due to error'));
                                responseStream.end();
                                return;
                            }
                        } else if (attachment.source?.media_type === 'application/pdf') {
                            // PDFの場合：S3から読み込み
                            try {
                                processedAttachment = await loadDocumentFromS3(attachment.s3Key, attachment.fileName);
                            } catch (error) {
                                console.error('[ERROR] S3 PDF読み込み失敗:', error);
                                responseStream.write(formatSSEEvent('error', `PDFの読み込みに失敗しました: ${error.message}`));
                                responseStream.write(formatSSEEvent('end', 'Stream ended due to error'));
                                responseStream.end();
                                return;
                            }
                        }
                    }
                    // Base64データの場合（既存の処理）
                    else if (attachment.source?.data) {
                        if (attachment.source.type === 'image') {
                            processedAttachment = {
                                image: {
                                    format: attachment.source.media_type.split('/')[1],
                                    source: {
                                        bytes: Buffer.from(attachment.source.data, 'base64')
                                    }
                                }
                            };
                        } else if (attachment.source.type === 'document') {
                            processedAttachment = {
                                document: {
                                    format: 'pdf',
                                    name: 'doc',
                                    source: {
                                        bytes: Buffer.from(attachment.source.data, 'base64')
                                    }
                                }
                            };
                        }
                    }
                    else {
                        console.error('[ERROR] 添付ファイルに必要なデータ（s3Keyまたはsource.data）がありません');
                        responseStream.write(formatSSEEvent('error', '添付ファイルのデータが不正です'));
                        responseStream.write(formatSSEEvent('end', 'Stream ended due to error'));
                        responseStream.end();
                        return;
                    }
                }
                
                const modelId = MODEL_MAPPING[modelKey];
                if (!modelId) {
                    console.error('[ERROR] サポートされていないモデル:', modelKey);
                    sendErrorResponse(responseStream, `サポートされていないモデル: ${modelKey}`);
                    return;
                }
                
                // メッセージ構築
                let converseMessages = [];
                let systemPrompt = null;
                const dbSavePrompt = userPrompt || '添付されたファイルについて説明してください。';
                
                // Knowledge Baseモードの処理
                if (mode === 'knowledge_base') {
                    try {
                        const retrieveCommand = new RetrieveCommand({
                            knowledgeBaseId: KNOWLEDGE_BASE_ID,
                            retrievalQuery: { text: userPrompt },
                            retrievalConfiguration: {
                                vectorSearchConfiguration: {
                                    numberOfResults: 10,
                                    overrideSearchType: 'HYBRID'
                                }
                            }
                        });
                        
                        const retrieveResponse = await bedrockAgentRuntime.send(retrieveCommand);
                        const retrievedChunks = retrieveResponse.retrievalResults || [];
                        
                        if (retrievedChunks.length > 0) {
                            let contextString = '<参考情報>\n';
                            
                            retrievedChunks.forEach((chunk, i) => {
                                const cleanText = chunk.content.text
                                    .replace(/\t+/g, ' ')
                                    .replace(/\n+/g, ' ')
                                    .replace(/\s+/g, ' ')
                                    .trim();
                                contextString += `<資料${i+1}>\n${cleanText}\n</資料${i+1}>\n`;
                            });
                            
                            contextString += '</参考情報>\n\n';
                            
                            // システムプロンプトとして設定
                            systemPrompt = 'あなたは優秀な社内情報検索アシスタントです。以下の参考資料を使用してユーザーの質問に正確に回答してください。\n\n';
                            systemPrompt += '## 回答ルール\n';
                            systemPrompt += '1. **情報が見つかった場合**: 参考資料から正確な情報を抽出し、簡潔に回答する\n';
                            systemPrompt += '2. **情報が見つからない場合**: 「申し訳ありませんが、該当する情報が見つかりませんでした」と回答する\n\n';
                            systemPrompt += contextString;
                        }
                        
                        // ユーザーメッセージはシンプルに質問のみ
                        converseMessages = [
                            ...historyMessages,
                            { role: 'user', content: [{ text: userPrompt }] }
                        ];
                        
                    } catch (error) {
                        console.error('[ERROR] Knowledge base error:', error);
                        responseStream.write(formatSSEEvent('message', 'Knowledge base unavailable, switching to general mode...\n\n'));
                        mode = 'general';
                    }
                }
                
                // Generalモードの処理
                if (mode === 'general') {
                    let userMessageContent = [];
                    
                    if (processedAttachment) {
                        userMessageContent.push(processedAttachment);
                    }
                    
                    const textContent = userPrompt || '添付されたファイルについて説明してください。';
                    userMessageContent.push({ text: textContent });
                    
                    converseMessages = [
                        ...historyMessages,
                        { role: 'user', content: userMessageContent }
                    ];
                }
                
                if (converseMessages.length === 0) {
                    console.error('[ERROR] メッセージコンテンツが空');
                    sendErrorResponse(responseStream, 'メッセージコンテンツが空です');
                    return;
                }
                
                console.log(`[DEBUG] 送信メッセージ数: ${converseMessages.length}`);
                console.log('[DEBUG] Using Converse API with model:', modelId);
                
                // Converse API リクエスト構築（1回だけ宣言）
                const converseRequest = {
                    modelId: modelId,
                    messages: converseMessages,
                    inferenceConfig: {
                        maxTokens: 4096,
                        temperature: 0.7
                    }
                };
                
                // システムプロンプトがある場合（Knowledge Baseモード）は追加
                if (systemPrompt) {
                    converseRequest.system = [{ text: systemPrompt }];
                }
                
                
                // Converse Stream APIを呼び出し
                const converseCommand = new ConverseStreamCommand(converseRequest);
                const response = await bedrockRuntime.send(converseCommand);
                
                let fullResponseText = '';
                
                // ストリーミングレスポンス処理
                try {
                    for await (const chunk of response.stream) {
                        // contentBlockDelta イベントの処理
                        if (chunk.contentBlockDelta) {
                            const textDelta = chunk.contentBlockDelta.delta?.text;
                            if (textDelta) {
                                fullResponseText += textDelta;
                                responseStream.write(formatSSEEvent('message', textDelta));
                            }
                        }
                        
                        // メッセージ停止の処理
                        if (chunk.messageStop) {
                            console.log('[DEBUG] Message stop reason:', chunk.messageStop.stopReason);
                        }
                        
                        // メタデータの処理
                        if (chunk.metadata) {
                            console.log('[DEBUG] Usage:', chunk.metadata.usage);
                        }
                    }
                } catch (streamError) {
                    console.error('[ERROR] Converse streaming error:', streamError);
                    responseStream.write(formatSSEEvent('error', 'Converse streaming failed'));
                    responseStream.write(formatSSEEvent('end', 'Stream ended due to error'));
                    responseStream.end();
                    return;
                }
                
                // DynamoDB保存処理
                try {
                    const getCommand = new GetCommand({
                        TableName: CHAT_TABLE_NAME,
                        Key: { userId }
                    });
                    const dbResponse = await dynamodb.send(getCommand);
                    const allChats = dbResponse.Item?.chats || [];
                    
                    const newMessageUser = {
                        id: userMessageId,
                        role: 'user',
                        content: dbSavePrompt
                    };
                    
                    if (processedAttachment && body.attachment) {
                        if (body.attachment.s3Key) {
                            newMessageUser.attachment = {
                                fileName: body.attachment.fileName || 'unknown_file',
                                fileType: body.attachment.source.media_type,
                                size: body.attachment.size || 0,
                                s3Key: body.attachment.s3Key,
                                isS3Upload: true
                            };
                        } else {
                            newMessageUser.attachment = {
                                fileName: body.attachment.fileName || 'unknown_file',
                                fileType: body.attachment.source.media_type,
                                size: body.attachment.size || 0,
                                isS3Upload: false,
                                note: '履歴では画像を表示できません（S3キーがありません）'
                            };
                        }
                    }
                    
                    const newMessageAssistant = {
                        id: assistantMessageId,
                        role: 'assistant',
                        content: fullResponseText,
                        mode: mode,
                        model: modelKey
                    };
                    
                    const isNewChat = !chatId;
                    
                    if (!isNewChat) {
                        const chatIndex = allChats.findIndex(chat => chat.id === chatId);
                        if (chatIndex !== -1) {
                            const existingMessages = allChats[chatIndex].messages || [];
                            const userMessageExists = existingMessages.some(msg => msg.id === userMessageId);
                            const assistantMessageExists = existingMessages.some(msg => msg.id === assistantMessageId);
                            
                            if (!userMessageExists && !assistantMessageExists) {
                                allChats[chatIndex].messages.push(newMessageUser, newMessageAssistant);
                                console.log('[DEBUG] 既存チャットにメッセージを追加');
                            }
                        }
                    } else {
                        const targetChatId = userMessageId;
                        const chatTitle = dbSavePrompt.substring(0, 30);
                        
                        const newChatThread = {
                            id: targetChatId,
                            title: chatTitle + (chatTitle.length >= 30 ? '...' : ''),
                            messages: [newMessageUser, newMessageAssistant]
                        };
                        
                        const existingChatIndex = allChats.findIndex(chat => chat.id === targetChatId);
                        if (existingChatIndex === -1) {
                            allChats.unshift(newChatThread);
                            console.log('[DEBUG] 新規チャットを作成');
                            responseStream.write(formatSSEEvent('newChat', newChatThread));
                        }
                    }
                    
                    const putCommand = new PutCommand({
                        TableName: CHAT_TABLE_NAME,
                        Item: { userId, chats: allChats }
                    });
                    
                    await dynamodb.send(putCommand);
                    
                } catch (error) {
                    console.error('[ERROR] DynamoDB保存エラー:', error);
                    responseStream.write(formatSSEEvent('warning', 'チャット履歴の保存に失敗しましたが、会話は続行できます'));
                }
                
                responseStream.write(formatSSEEvent('end', 'Stream ended'));
                
            } catch (error) {
                console.error('[ERROR] Processing error:', error);
                responseStream.write(formatSSEEvent('error', error.message));
                responseStream.write(formatSSEEvent('end', 'Stream ended due to error'));
            }
            
            responseStream.end();
        }
        
    } catch (error) {
        console.error('[ERROR] Fatal error:', error);
        console.error('[ERROR] Error stack:', error.stack);
        responseStream.write(formatSSEEvent('error', `Fatal error: ${error.message}`));
        responseStream.write(formatSSEEvent('end', 'Stream ended due to fatal error'));
        responseStream.end();
    }
});