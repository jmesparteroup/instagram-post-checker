// Global test setup file
import { config } from 'dotenv';

// Load environment variables for testing
config({ path: '.env.local' });

// Mock console methods to reduce noise in tests unless explicitly needed
const originalConsole = { ...console };

beforeEach(() => {
  // Reset console mocks before each test
  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();
  console.info = jest.fn();
});

afterEach(() => {
  // Clean up after each test
  jest.clearAllMocks();
});

// Utility to restore console for debugging specific tests
global.restoreConsole = () => {
  Object.assign(console, originalConsole);
};

// Global test utilities
global.testUtils = {
  // Mock Instagram post data for testing
  mockInstagramPost: {
    caption: 'Test caption with #sponsored content',
    hashtags: ['sponsored', 'ad', 'partnership'],
    altText: 'Test alt text description',
    transcript: 'This is a test video transcript mentioning sponsored content',
    mediaType: 'video' as const,
  },
  
  // Mock requirements for testing
  mockRequirements: [
    'Must include #ad or #sponsored hashtag',
    'Must mention partnership in caption or audio',
    'Disclosure must be above the fold (first 150 characters)',
  ],
};

// Increase timeout for async tests
jest.setTimeout(30000); 