import { useMutation } from '@tanstack/react-query';

interface AnalysisResult {
  requirement: string;
  passed: boolean;
  explanation: string;
}

interface AnalysisReport {
  results: AnalysisResult[];
  overallScore: number;
  aiPowered: boolean;
  processingTime: number;
  model: string;
}

interface ApiResponse {
  success: boolean;
  postData?: {
    caption: string;
    mediaType: string;
    mediaUrl: string;
    transcript: string;
    hashtags: string[];
    altText: string;
  };
  analysis?: AnalysisReport;
  error?: string;
}

interface AnalyzePostVariables {
  postUrl: string;
  requirements: string;
  useAI?: boolean;
}

const analyzePost = async (variables: AnalyzePostVariables): Promise<ApiResponse> => {
  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(variables),
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Failed to analyze post');
  }

  return response.json();
};

export const useAnalyzePost = () => {
  return useMutation({
    mutationFn: analyzePost,
  });
}; 