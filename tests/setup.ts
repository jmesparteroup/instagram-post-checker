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
    timestampedTranscript: {
      text: 'This is a test video transcript mentioning sponsored content',
      segments: [
        {
          text: 'This is a test video transcript',
          start: 0.5,
          end: 3.2,
          words: [
            { word: 'This', start: 0.5, end: 0.8 },
            { word: 'is', start: 0.8, end: 1.0 },
            { word: 'a', start: 1.0, end: 1.1 },
            { word: 'test', start: 1.1, end: 1.4 },
            { word: 'video', start: 1.4, end: 1.8 },
            { word: 'transcript', start: 1.8, end: 3.2 }
          ]
        },
        {
          text: 'mentioning sponsored content',
          start: 3.5,
          end: 6.0,
          words: [
            { word: 'mentioning', start: 3.5, end: 4.2 },
            { word: 'sponsored', start: 4.2, end: 5.0 },
            { word: 'content', start: 5.0, end: 6.0 }
          ]
        }
      ]
    },
    mediaType: 'video' as const,
    mediaUrl: 'https://example.com/test-video.mp4',
  },
  
  // Mock requirements for testing
  mockRequirements: [
    'Must include #ad or #sponsored hashtag',
    'Must mention partnership in caption or audio',
    'Disclosure must be above the fold (first 150 characters)',
    'Sponsored content disclosure must appear within the first 10 seconds of the video',
    'Product mention (protein) must occur within the first 15 seconds',
  ],
};

// Increase timeout for async tests
jest.setTimeout(30000); 