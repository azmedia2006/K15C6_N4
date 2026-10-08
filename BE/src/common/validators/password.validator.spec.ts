import { validatePassword, getPasswordRules } from './password.validator';

/**
 * KN-46: Unit tests cho password validator (KN-45)
 */
describe('validatePassword', () => {
  it('mật khẩu hợp lệ (đủ 8 ký tự, có hoa, thường, số)', () => {
    const result = validatePassword('MyPass12');
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('mật khẩu quá ngắn', () => {
    const result = validatePassword('Ab1');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Mật khẩu phải có ít nhất 8 ký tự.');
  });

  it('thiếu chữ hoa', () => {
    const result = validatePassword('mypass12');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Mật khẩu phải chứa ít nhất một chữ cái viết hoa.');
  });

  it('thiếu chữ thường', () => {
    const result = validatePassword('MYPASS12');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Mật khẩu phải chứa ít nhất một chữ cái viết thường.');
  });

  it('thiếu chữ số', () => {
    const result = validatePassword('MyPasswd');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Mật khẩu phải chứa ít nhất một chữ số.');
  });

  it('mật khẩu rỗng → tất cả lỗi', () => {
    const result = validatePassword('');
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(4);
  });

  it('lỗi tiếng Việt, cụ thể từng quy tắc', () => {
    const result = validatePassword('abc');
    for (const err of result.errors) {
      // Kiểm tra mọi thông báo là tiếng Việt (chứa dấu)
      expect(err).toMatch(/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i);
    }
  });
});

describe('getPasswordRules', () => {
  it('trả về danh sách quy tắc', () => {
    const rules = getPasswordRules();
    expect(rules.length).toBeGreaterThanOrEqual(4);
    expect(rules[0]).toContain('8 ký tự');
  });
});
