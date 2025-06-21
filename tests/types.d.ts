// Type declarations for global test utilities
import { InstagramPostData } from '../src/lib/instagram-service';

declare global {
  function restoreConsole(): void;
  
  var testUtils: {
    mockInstagramPost: InstagramPostData;
    mockRequirements: string[];
  };
} 