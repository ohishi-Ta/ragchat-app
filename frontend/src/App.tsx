import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Authenticator } from '@aws-amplify/ui-react';
import { signOut, signUp, confirmSignUp } from 'aws-amplify/auth';
import { Amplify } from 'aws-amplify';
import { I18n } from 'aws-amplify/utils';
import { JA_TRANSLATIONS } from './ja';
import { translations } from '@aws-amplify/ui-react';
import { ImageProvider } from './contexts/ImageContext'; // 🎯 追加
import ChatPage from './pages/ChatPage';
import ImageGenerationPage from './pages/ImageGenerationPage';
import amplifyConfig from './amplifyconfiguration';
import '@aws-amplify/ui-react/styles.css';
import './amplify-ui-theme.css';
import './App.css';

// Amplify設定を適用
Amplify.configure(amplifyConfig);

// カスタムサインイン/サインアップ設定
const formFields = {
  signIn: {
    username: {
      placeholder: 'ユーザー名を入力してください',
      isRequired: true,
      label: 'ユーザー名 *',
    },
    password: {
      placeholder: 'パスワードを入力してください',
      isRequired: true,
      label: 'パスワード *',
      labelsub: 'パスワード'
    },
  },
  signUp: {
    username: {
      placeholder: 'ユーザー名を入力してください',
      isRequired: true,
      label: 'ユーザー名 *',
    },
    email: {
      placeholder: 'メールアドレスを入力してください',
      isRequired: true,
      label: 'メールアドレス *',
    },
    password: {
      placeholder: 'パスワードを入力してください',
      isRequired: true,
      label: 'パスワード *',
    },
    confirm_password: {
      placeholder: 'パスワードを再入力してください',
      isRequired: true,
      label: 'パスワード確認 *',
    },
  },
  confirmSignUp: {
    confirmation_code: {
      placeholder: '6桁の確認コードを入力してください',
      isRequired: true,
      label: '確認コード *',
    },
  },
};

// Amplify UI日本語辞書の設定
I18n.putVocabularies(translations);
I18n.putVocabularies(JA_TRANSLATIONS);
I18n.setLanguage('ja');

function App() {
  // 確認完了状態を管理
  const [isConfirmationComplete, setIsConfirmationComplete] = useState(false);

  // カスタムサービス（Post-Confirmation対応）
  const services = {
    async validateCustomSignUp(formData: any) {
      const errors: any = {};
      
      if (formData.password) {
        const password = formData.password;
        
        // 8文字以上チェック
        if (password.length < 8) {
          errors.password = 'パスワードは8文字以上である必要があります';
          return errors;
        }
        
        // 小文字チェック
        if (!/[a-z]/.test(password)) {
          errors.password = 'パスワードには小文字を1文字以上含める必要があります';
          return errors;
        }
        
        // 大文字チェック
        if (!/[A-Z]/.test(password)) {
          errors.password = 'パスワードには大文字を1文字以上含める必要があります';
          return errors;
        }
        
        // 数字チェック
        if (!/\d/.test(password)) {
          errors.password = 'パスワードには数字を1文字以上含める必要があります';
          return errors;
        }
      }
      
      return errors;
    },

    async handleSignUp(input: any) {
      const { username, password, attributes, options } = input;
      
      try {
        console.log('サインアップ入力:', { username, password, attributes, options });
        
        // 属性を正しい形式に変換
        const userAttributes: { [key: string]: string } = {};
        
        // attributesまたはoptions.userAttributesからemail属性を取得
        const emailValue = attributes?.email || options?.userAttributes?.email;
        if (emailValue) {
          userAttributes.email = emailValue;
        }
        
        // サインアップを実行（通常のフロー）
        const result = await signUp({
          username,
          password,
          options: {
            userAttributes,
            autoSignIn: {
              enabled: false // 自動サインインを無効化
            }
          }
        });
        
        console.log('サインアップ結果:', result);
        console.log(`サインアップ完了、確認コード送信: ${username}`);
        
        return result;
        
      } catch (error) {
        console.error('サインアップエラー:', error);
        throw error;
      }
    },
    
    async handleConfirmSignUp(input: any) {
      const { username, confirmationCode } = input;
      
      try {
        console.log('確認コード処理開始:', { username, confirmationCode });
        
        // 確認コードを検証
        const result = await confirmSignUp({
          username,
          confirmationCode
        });
        
        console.log('確認コード検証結果:', result);
        
        // すぐに確認完了画面を表示（Authenticatorから抜ける）
        setTimeout(() => {
          setIsConfirmationComplete(true);
        }, 100);
        
        return result;
        
      } catch (error: any) {
        console.error('確認コードエラー:', error);
        throw error;
      }
    }
  };

  // カスタムサインアウト関数
  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('サインアウトエラー:', error);
    }
  };

  // 確認完了画面コンポーネント
  const ConfirmationCompleteScreen = () => (
    <div style={{ 
      width: '100%', 
      position: 'fixed',
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      height: '100%',
      top: '0',
      left: '0',
      padding: '20px'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '40px',
        textAlign: 'center',
        maxWidth: '500px',
        width: '100%',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        placeSelf : 'center'
      }}>
        <h2 style={{ color: '#1976d2', margin: '0 0 16px 0' }}>
          メールアドレス確認完了
        </h2>
        <div style={{ 
          background: '#e8f5e8', 
          padding: '20px', 
          borderRadius: '12px',
          border: '2px solid #4caf50',
          margin: '0 auto 20px'
        }}>
          <p style={{ margin: '0 0 12px 0', fontWeight: 'bold', color: '#2e7d32', fontSize: '18px' }}>
            アカウント申請を受け付けました
          </p>
          <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#2e7d32' }}>
            メールアドレスの確認が完了しました。<br />
            管理者による承認をお待ちください。
          </p>
          <p style={{ margin: 0, fontSize: '11px', color: '#666' }}>
            承認完了後、別途メールにてご連絡いたします
          </p>
        </div>
        <button 
          type="button"
          onClick={() => {
            window.location.reload();
          }}
          style={{
            background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
            color: 'white',
            border: 'none',
            padding: '14px 32px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: '600',
            boxShadow: '0 4px 12px rgba(25, 118, 210, 0.3)',
            transition: 'all 0.2s ease'
          }}
        >
          ログイン画面に戻る
        </button>
      </div>
    </div>
  );

  // 確認完了画面を表示
  if (isConfirmationComplete) {
    return <ConfirmationCompleteScreen />;
  }

  return (
    <Authenticator
      loginMechanisms={['username']}
      signUpAttributes={['email']}
      formFields={formFields}
      services={services}
      hideSignUp={false}
      passwordSettings={{}}
      components={{
        Header() {
          return (
            <div style={{ 
              textAlign: 'center', 
              padding: '20px 0',
              background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
              color: 'white',
              marginBottom: '20px',
              borderRadius: '8px 8px 0 0'
            }}>
              <h1 style={{ margin: '0 0 8px 0', fontSize: '24px', fontWeight: 'bold' }}>
                RagChat
              </h1>
            </div>
          );
        },
        ConfirmSignUp: {
          Header() {
            return (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <h2 style={{ color: '#1976d2', margin: '0 0 16px 0' }}>
                  メールアドレス確認
                </h2>
                <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#666' }}>
                  登録されたメールアドレスに送信された<br />
                  6桁の確認コードを入力してください。
                </p>
              </div>
            );
          }
        }
      }}
      variation="modal"
    >
      {({ user }) => {
        // 認証済みユーザーがいる場合は通常のアプリを表示
        if (user && !isConfirmationComplete) {
          return (
            // 🎯 ImageProviderでアプリ全体をラップ
            <ImageProvider>
              <Router>
                <Routes>
                  <Route path="/" element={<Navigate to="/chat" replace />} />
                  <Route 
                    path="/chat" 
                    element={
                      <ChatPage 
                        user={user} 
                        signOut={handleSignOut}
                      />
                    } 
                  />
                  <Route 
                    path="/chat/:chatId" 
                    element={
                      <ChatPage 
                        user={user} 
                        signOut={handleSignOut}
                      />
                    } 
                  />
                  <Route 
                    path="/image" 
                    element={
                      <ImageGenerationPage 
                        user={user} 
                        signOut={handleSignOut}
                      />
                    } 
                  />
                </Routes>
              </Router>
            </ImageProvider>
          );
        }
        
        // 認証されていない場合は空のdivを返す（Authenticatorが表示される）
        return <div></div>;
      }}
    </Authenticator>
  );
}

export default App;