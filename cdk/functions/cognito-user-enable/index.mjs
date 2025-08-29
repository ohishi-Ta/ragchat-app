import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const sesClient = new SESClient({ region: 'ap-northeast-1' });

// 環境変数
const SYSTEM_EMAIL = process.env.SYSTEM_EMAIL;
const SERVICE_URL = process.env.SERVICE_URL;

export const handler = async (event) => {
  try {
    console.log('EventBridge 受信イベント全体:', JSON.stringify(event, null, 2));
    
    // 環境変数チェック
    if (!SYSTEM_EMAIL) {
      console.error('SYSTEM_EMAIL環境変数が設定されていません');
      return;
    }
    
    if (!SERVICE_URL) {
      console.error('SERVICE_URL環境変数が設定されていません');
      return;
    }
    
    // EventBridge経由のCognito API呼び出しイベントをパース
    const { detail } = event;
    console.log('detail部分:', JSON.stringify(detail, null, 2));
    
    // AdminEnableUser APIの場合のみ処理
    if (detail.eventName !== 'AdminEnableUser') {
      console.log('AdminEnableUser以外のイベントのためスキップ:', detail.eventName);
      return;
    }
    
    // デバッグ: イベント詳細をログ出力
    console.log('EventBridge detail:', JSON.stringify(detail, null, 2));
    console.log('requestParameters:', JSON.stringify(detail.requestParameters, null, 2));
    console.log('additionalEventData:', JSON.stringify(detail.additionalEventData, null, 2));
    
    // ユーザー情報を取得
    const userPoolId = detail.requestParameters?.userPoolId;
    const userSub = detail.additionalEventData?.sub; // ユーザーのUUIDを使用
    
    console.log('取得したパラメータ:', { userSub, userPoolId });
    
    if (!userSub || !userPoolId) {
      console.error('必要なパラメータが不足:', { userSub, userPoolId });
      return;
    }
    
    // ユーザー詳細情報を取得（SUBを使用してユーザーを検索）
    const { CognitoIdentityProviderClient, ListUsersCommand, AdminGetUserCommand } = await import("@aws-sdk/client-cognito-identity-provider");
    const cognitoClient = new CognitoIdentityProviderClient({ region: 'ap-northeast-1' });
    
    // SUBでユーザーを検索
    const listUsersCommand = new ListUsersCommand({
      UserPoolId: userPoolId,
      Filter: `sub = "${userSub}"`
    });
    
    const listUsersResult = await cognitoClient.send(listUsersCommand);
    
    if (!listUsersResult.Users || listUsersResult.Users.length === 0) {
      console.error('SUBに該当するユーザーが見つかりません:', userSub);
      return;
    }
    
    const user = listUsersResult.Users[0];
    const userName = user.Username;
    
    // メールアドレスを検索
    const emailAttribute = user.Attributes?.find(attr => attr.Name === 'email');
    const userEmail = emailAttribute?.Value;
    
    if (!userEmail) {
      console.error('ユーザーのメールアドレスが見つかりません:', userName);
      return;
    }
    
    // ログに詳細情報を出力
    console.log('見つかったユーザー:', { userName, userSub, userEmail });
    
    // 承認完了メールを送信
    const emailParams = {
      Source: SYSTEM_EMAIL, // 送信者（システムメール）
      Destination: {
        ToAddresses: [userEmail] // 受信者（ユーザーメール）
      },
      Message: {
        Subject: {
          Data: '【CPI社内文書AI】アカウント承認完了のお知らせ',
          Charset: 'UTF-8'
        },
        Body: {
          Html: {
            Data: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #1976d2; border-bottom: 2px solid #1976d2; padding-bottom: 10px;">
                  アカウント承認完了
                </h2>
                
                <div style="background-color: #e8f5e8; padding: 20px; border-left: 4px solid #4caf50; margin: 20px 0;">
                  <p style="margin: 0; font-weight: bold; color: #2e7d32; font-size: 18px;">
                    アカウントの承認が完了しました
                  </p>
                </div>
                
                <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <p style="margin: 0 0 16px 0; font-weight: bold;">ユーザー名: ${userName}</p>
                  <p style="margin: 0 0 16px 0; font-weight: bold;">メールアドレス: ${userEmail}</p>
                  <p style="margin: 0; font-weight: bold;">承認日時: ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}</p>
                </div>
                
                <div style="background-color: #e3f2fd; padding: 15px; border-left: 4px solid #1976d2; margin: 20px 0;">
                  <p style="margin: 0 0 12px 0; font-weight: bold;">CPI社内文書AIをご利用いただけます</p>
                  <p style="margin: 0 0 12px 0;">以下のリンクからアクセスしてログインしてください</p>
                  <div style="text-align: center; margin: 30px 0;">
                  <a href="${SERVICE_URL}" 
                     target="_blank" 
                     style="background-color: #4caf50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 0 10px 10px 0;">
                     すぐに利用する
                  </a>
                </div>
                </div>

                <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                <p style="font-size: 12px; color: #666; text-align: center;">
                  このメールは自動送信されています。<br>
                </p>
              </div>
            `,
            Charset: 'UTF-8'
          }
        }
      }
    };
    
    await sesClient.send(new SendEmailCommand(emailParams));
    
    console.log(`ユーザー承認完了通知送信完了: ${userName} (${userEmail})`);
    
  } catch (error) {
    console.error('ユーザー有効化通知Lambda エラー:', error);
    throw error;
  }
};