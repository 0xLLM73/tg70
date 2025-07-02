import { validateEmail, isDisposableEmail, maskEmail } from '../../src/utils/emailValidator.js';

describe('emailValidator', () => {
  describe('validateEmail', () => {
    test('should validate correct email addresses', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'test123@test-domain.org',
        'valid.email@subdomain.example.com',
      ];

      validEmails.forEach(email => {
        const result = validateEmail(email);
        expect(result.isValid).toBe(true);
        expect(result.normalizedEmail).toBe(email.toLowerCase());
        expect(result.error).toBeUndefined();
      });
    });

    test('should normalize email to lowercase', () => {
      const result = validateEmail('TEST@EXAMPLE.COM');
      expect(result.isValid).toBe(true);
      expect(result.normalizedEmail).toBe('test@example.com');
    });

    test('should trim whitespace from email', () => {
      const result = validateEmail('  test@example.com  ');
      expect(result.isValid).toBe(true);
      expect(result.normalizedEmail).toBe('test@example.com');
    });

    test('should reject empty email', () => {
      const result = validateEmail('');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Email address is required');
    });

    test('should reject whitespace-only email', () => {
      const result = validateEmail('   ');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Email address is required');
    });

    test('should reject emails longer than 320 characters', () => {
      const longEmail = 'a'.repeat(310) + '@test.com';
      const result = validateEmail(longEmail);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Email address is too long (max 320 characters)');
    });

    test('should reject invalid email formats', () => {
      const invalidEmails = [
        'notanemail',
        '@example.com',
        'test@',
        'test..test@example.com',
        'test@example',
        'test space@example.com',
      ];

      invalidEmails.forEach(email => {
        const result = validateEmail(email);
        expect(result.isValid).toBe(false);
        expect(result.error).toBeDefined();
      });
    });

    test('should reject emails with consecutive dots', () => {
      const result = validateEmail('test..dots@example.com');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Email address cannot contain consecutive dots');
    });

    test('should reject emails starting with dot', () => {
      const result = validateEmail('.test@example.com');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Email address format is invalid');
    });

    test('should reject emails ending with dot', () => {
      const result = validateEmail('test.@example.com');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Email address format is invalid');
    });

    test('should reject emails with multiple @ symbols', () => {
      const result = validateEmail('test@@example.com');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Email address format is invalid');
    });

    test('should handle validation errors gracefully', () => {
      // Mock validator.isEmail to throw an error
      jest.doMock('validator', () => ({
        isEmail: jest.fn(() => {
          throw new Error('Validator error');
        }),
      }), { virtual: true });

      const result = validateEmail('test@example.com');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Failed to validate email address');
    });
  });

  describe('isDisposableEmail', () => {
    test('should identify disposable email providers', () => {
      const disposableEmails = [
        'test@10minutemail.com',
        'user@guerrillamail.com',
        'temp@mailinator.com',
        'test@tempmail.org',
        'user@yopmail.com',
      ];

      disposableEmails.forEach(email => {
        expect(isDisposableEmail(email)).toBe(true);
      });
    });

    test('should not flag legitimate email providers', () => {
      const legitimateEmails = [
        'test@gmail.com',
        'user@outlook.com',
        'business@company.com',
        'personal@mydomain.org',
      ];

      legitimateEmails.forEach(email => {
        expect(isDisposableEmail(email)).toBe(false);
      });
    });

    test('should handle case insensitive domains', () => {
      expect(isDisposableEmail('test@MAILINATOR.COM')).toBe(true);
      expect(isDisposableEmail('test@Tempmail.Org')).toBe(true);
    });
  });

  describe('maskEmail', () => {
    test('should mask normal email addresses', () => {
      expect(maskEmail('john.doe@example.com')).toBe('j***@e***');
      expect(maskEmail('test@domain.org')).toBe('t***@d***');
    });

    test('should handle short local parts', () => {
      expect(maskEmail('a@example.com')).toBe('a***@e***');
    });

    test('should handle short domains', () => {
      expect(maskEmail('test@a.com')).toBe('t***@a***');
    });

    test('should handle invalid email formats', () => {
      expect(maskEmail('notanemail')).toBe('***');
      expect(maskEmail('')).toBe('***');
      expect(maskEmail('test@')).toBe('***');
    });

    test('should handle emails without @ symbol', () => {
      expect(maskEmail('justtext')).toBe('***');
    });

    test('should limit mask length', () => {
      const longEmail = 'verylongemailaddress@verylongdomainname.com';
      const masked = maskEmail(longEmail);
      expect(masked).toBe('v***@v***');
    });
  });
});