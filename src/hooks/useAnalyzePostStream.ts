import { useMutation } from '@tanstack/react-query';

interface ProgressUpdate {
  step: 'validating' | 'fetching' | 'transcribing' | 'analyzing' | 'complete' | 'error';
  message: string;
  progress: number;
  data?: unknown;
  error?: string;
}

interface AnalyzePostStreamVariables {
  postUrl: string;
  requirements: string;
  onProgress?: (update: ProgressUpdate) => void;
}

const analyzePostStream = async ({ postUrl, requirements, onProgress }: AnalyzePostStreamVariables) => {
  const response = await fetch('/api/analyze-stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      postUrl: postUrl.trim(),
      requirements: requirements.trim(),
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  if (!response.body) {
    throw new Error('No response body');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data: ProgressUpdate = JSON.parse(line.slice(6));
          onProgress?.(data);
          
          // If we have a complete step with data, return the final result
          if (data.step === 'complete' && data.data) {
            return data.data;
          }
          
          // If we have an error, throw it
          if (data.step === 'error') {
            throw new Error(data.error || 'An error occurred');
          }
        } catch {
          console.warn('Failed to parse SSE data:', line);
        }
      }
    }
  }
};

export const useAnalyzePostStream = () => {
  return useMutation({
    mutationFn: analyzePostStream,
  });
}; 