import { CognitoIdentityProviderClient, AdminDisableUserCommand } from "@aws-sdk/client-cognito-identity-provider";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const cognitoClient = new CognitoIdentityProviderClient({ region: 'ap-northeast-1' });
const sesClient = new SESClient({ region: 'ap-northeast-1' });

// 環境変数
const ADMIN_EMAILS = process.env.ADMIN_EMAILS;
const SYSTEM_EMAIL = process.env.SYSTEM_EMAIL;

// 個別にメールを送信する関数
const sendIndividualEmail = async (toEmail, emailContent) => {
  try {
    const emailParams = {
      Source: SYSTEM_EMAIL,
      Destination: {
        ToAddresses: [toEmail] // 単一のメールアドレス
      },
      Message: emailContent
    };
    
    await sesClient.send(new SendEmailCommand(emailParams));
    return { email: toEmail, success: true };
  } catch (error) {
    console.error(`メール送信失敗: ${toEmail} - ${error.message}`);
    return { 
      email: toEmail, 
      success: false, 
      error: error.message || '不明なエラー' 
    };
  }
};

export const handler = async (event) => {
  try {
    console.log('Post-Confirmation実行:', event.userName);
    
    // 環境変数チェック
    if (!ADMIN_EMAILS || !SYSTEM_EMAIL) {
      console.error('環境変数未設定:', { ADMIN_EMAILS, SYSTEM_EMAIL });
      return event;
    }
    
    // 管理者メールアドレスを配列に変換
    const adminEmailList = ADMIN_EMAILS
      .split(',')
      .map(email => email.trim())
      .filter(email => email && email.includes('@'));
    
    if (adminEmailList.length === 0) {
      console.error('有効な管理者メールアドレスなし');
      return event;
    }
    
    const { userName, userPoolId, request: { userAttributes } } = event;
    const email = userAttributes.email;
    const userSub = userAttributes.sub;
    
    // Cognitoユーザー詳細画面の直接URL
    const cognitoUserUrl = `https://ap-northeast-1.console.aws.amazon.com/cognito/v2/idp/user-pools/${userPoolId}/user-management/users/details/${userSub}?region=ap-northeast-1`;
    
    // === ステップ1: ユーザーを無効化する ===
    const disableUserCommand = new AdminDisableUserCommand({
      UserPoolId: userPoolId,
      Username: userName,
    });
    
    // メールコンテンツを作成
    const emailContent = {
      Subject: {
        Data: '【CPI社内文書AI】新規ユーザー承認依頼',
        Charset: 'UTF-8'
      },
      Body: {
        Html: {
          Data: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #1976d2; border-bottom: 2px solid #1976d2; padding-bottom: 10px;">
                新規ユーザー承認依頼
              </h2>
              
              <div style="background-color: #e8f5e8; padding: 15px; border-left: 4px solid #4caf50; margin: 20px 0;">
                <p style="margin: 0; font-weight: bold; color: #2e7d32;">
                  ユーザーがメールアドレス確認を完了しました
                </p>
              </div>
              
              <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; font-weight: bold; width: 120px;">ユーザー名:</td>
                    <td style="padding: 8px 0;">${userName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; font-weight: bold;">メールアドレス:</td>
                    <td style="padding: 8px 0;">${email}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; font-weight: bold;">確認完了日時:</td>
                    <td style="padding: 8px 0;">${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; font-weight: bold;">ステータス:</td>
                    <td style="padding: 8px 0;"><span style="background: #ffeb3b; padding: 2px 8px; border-radius: 4px;">承認待ち</span></td>
                  </tr>
                </table>
              </div>
              
              <div style="background-color: #e3f2fd; padding: 15px; border-left: 4px solid #1976d2; margin: 20px 0;">
                <p style="margin: 0 0 10px 0; font-weight: bold;">承認手順:</p>
                <ol style="margin: 10px 0; padding-left: 20px;">
                  <li>下記の「ユーザー詳細画面を開く」ボタンをクリック</li>
                  <li>ユーザー詳細画面で「アクション」→「ユーザーアクセスを有効にする」を実行</li>
                </ol>
                <p style="margin: 10px 0 0 0; font-size: 12px; color: #666;">
                  ※ユーザーは現在無効化状態のため、承認するまでログインできません
                </p>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${cognitoUserUrl}" 
                   target="_blank" 
                   style="background-color: #4caf50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 0 10px 10px 0;">
                  ユーザー詳細画面を開く
                </a>
              </div>

              
              <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
              <p style="font-size: 12px; color: #666; text-align: center;">
                このメールは自動送信されています。
              </p>
            </div>
          `,
          Charset: 'UTF-8'
        }
      }
    };
    
    // === ステップ2: ユーザー無効化と個別メール送信を並行実行 ===
    const [disableResult, ...emailResults] = await Promise.allSettled([
      // ユーザー無効化
      cognitoClient.send(disableUserCommand),
      // 各管理者メールアドレスに個別にメール送信
      ...adminEmailList.map(adminEmail => sendIndividualEmail(adminEmail, emailContent))
    ]);
    
    // 結果集計
    const emailSendResults = emailResults.map(result => 
      result.status === 'fulfilled' ? result.value : { success: false }
    );
    
    const successCount = emailSendResults.filter(result => result.success).length;
    
    console.log(`処理完了: ${userName} (${email}) - メール送信 ${successCount}/${adminEmailList.length}件成功`);
    
    return event;
    
  } catch (error) {
    console.error('Post-Confirmation エラー:', error);
    return event;
  }
};