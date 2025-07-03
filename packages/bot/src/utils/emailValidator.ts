import validator from 'validator';
import type { EmailValidation } from '../types/index.js';

/**
 * Validate and normalize email address
 * Uses validator.isEmail with normalization as per requirements
 */
export function validateEmail(email: string): EmailValidation {
  try {
    // Trim and convert to lowercase
    const trimmedEmail = email.trim().toLowerCase();
    
    // Basic format validation
    if (!trimmedEmail || trimmedEmail.length === 0) {
      return {
        isValid: false,
        error: 'Email address is required',
      };
    }
    
    // Length check (RFC 5321 limit)
    if (trimmedEmail.length > 320) {
      return {
        isValid: false,
        error: 'Email address is too long (max 320 characters)',
      };
    }
    
    // Use validator.js for comprehensive email validation
    if (!validator.isEmail(trimmedEmail)) {
      return {
        isValid: false,
        error: 'Please enter a valid email address',
      };
    }
    
    // Additional checks for common issues
    if (trimmedEmail.includes('..')) {
      return {
        isValid: false,
        error: 'Email address cannot contain consecutive dots',
      };
    }
    
    // Check for suspicious patterns
    const suspiciousPatterns = [
      /^[.]/,  // starts with dot
      /[.]$/,  // ends with dot
      /[@]{2,}/, // multiple @ symbols
      /[.@]{2,}/, // consecutive special chars
    ];
    
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(trimmedEmail)) {
        return {
          isValid: false,
          error: 'Email address format is invalid',
        };
      }
    }
    
    return {
      isValid: true,
      normalizedEmail: trimmedEmail,
    };
  } catch (error) {
    return {
      isValid: false,
      error: 'Failed to validate email address',
    };
  }
}

/**
 * Check if email domain is from a disposable email provider
 * Basic implementation - could be enhanced with a comprehensive list
 */
export function isDisposableEmail(email: string): boolean {
  const disposableDomains = [
    '10minutemail.com',
    'guerrillamail.com',
    'mailinator.com',
    'tempmail.org',
    'yopmail.com',
    'temp-mail.org',
    'throwaway.email',
  ];
  
  const domain = email.toLowerCase().split('@')[1];
  return disposableDomains.includes(domain);
}

/**
 * Mask email for display purposes
 * Example: john.doe@example.com -> j***@e***
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) {
    return '***';
  }
  
  const [local, domain] = email.split('@');
  
  if (local.length <= 1) {
    return `${local}***@${domain.charAt(0)}***`;
  }
  
  const maskedLocal = local.charAt(0) + '*'.repeat(Math.min(local.length - 1, 3));
  const maskedDomain = domain.charAt(0) + '*'.repeat(Math.min(domain.length - 1, 3));
  
  return `${maskedLocal}@${maskedDomain}`;
}