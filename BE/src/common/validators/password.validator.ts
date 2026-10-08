/**
 * KN-45: Quy tắc xác thực mật khẩu
 *
 * Chính sách: tối thiểu 8 ký tự, gồm chữ hoa, chữ thường, số.
 * Validate ở cả client (JS) và server (file này).
 * Thông báo lỗi tiếng Việt, cụ thể từng quy tắc.
 */

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
}

const PASSWORD_RULES = [
  {
    test: (pw: string) => pw.length >= 8,
    message: 'Mật khẩu phải có ít nhất 8 ký tự.',
  },
  {
    test: (pw: string) => /[A-Z]/.test(pw),
    message: 'Mật khẩu phải chứa ít nhất một chữ cái viết hoa.',
  },
  {
    test: (pw: string) => /[a-z]/.test(pw),
    message: 'Mật khẩu phải chứa ít nhất một chữ cái viết thường.',
  },
  {
    test: (pw: string) => /[0-9]/.test(pw),
    message: 'Mật khẩu phải chứa ít nhất một chữ số.',
  },
];

/**
 * Validate mật khẩu theo chính sách.
 * Trả về danh sách lỗi cụ thể bằng tiếng Việt.
 */
export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];

  for (const rule of PASSWORD_RULES) {
    if (!rule.test(password)) {
      errors.push(rule.message);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Trả về danh sách quy tắc mật khẩu (dùng cho client hiển thị)
 */
export function getPasswordRules(): string[] {
  return PASSWORD_RULES.map((r) => r.message);
}
