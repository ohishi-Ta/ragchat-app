import React from 'react';

interface SignOutConfirmationModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  userEmail?: string;
}

const SignOutConfirmationModal: React.FC<SignOutConfirmationModalProps> = ({
  isOpen,
  onConfirm,
  onCancel,
  userEmail
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>サインアウトの確認</h2>
        <p>
          {userEmail && <><strong>{userEmail}</strong> から</>}
          本当にサインアウトしますか？
        </p>
        <div className="modal-actions">
          <button onClick={onCancel} className="cancel-button">
            キャンセル
          </button>
          <button onClick={onConfirm} className="confirm-button">
            サインアウト
          </button>
        </div>
      </div>
    </div>
  );
};

export default SignOutConfirmationModal;