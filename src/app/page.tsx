'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, XCircle, Loader2, Instagram, AlertCircle } from 'lucide-react';
import ProgressIndicator, { ProgressStep } from '@/components/ui/progress-indicator';

interface AnalysisResult {
  requirement: string;
  passed: boolean;
  explanation: string;
}

interface AnalysisReport {
  results: AnalysisResult[];
  overallScore: number;
}

interface ApiResponse {
  success: boolean;
  postData?: {
    caption: string;
    mediaType: string;
    mediaUrl: string;
  };
  analysis?: AnalysisReport;
  error?: string;
}

interface ProgressUpdate {
  step: 'validating' | 'fetching' | 'transcribing' | 'analyzing' | 'complete' | 'error';
  message: string;
  progress: number;
  data?: unknown;
  error?: string;
}

export default function Home() {
  const [postUrl, setPostUrl] = useState('');
  const [requirements, setRequirements] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [useRealTime, setUseRealTime] = useState(true);
  const [results, setResults] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Real-time progress state
  const [progressSteps, setProgressSteps] = useState<ProgressStep[]>([]);
  const [overallProgress, setOverallProgress] = useState(0);
  const eventSourceRef = useRef<EventSource | null>(null);

  const initializeProgressSteps = (hasVideo: boolean = false): ProgressStep[] => [
    {
      id: 'validating',
      label: 'Validating Input',
      status: 'pending',
    },
    {
      id: 'fetching',
      label: 'Fetching Instagram Data',
      status: 'pending',
    },
    ...(hasVideo ? [{
      id: 'transcribing',
      label: 'Transcribing Video',
      status: 'pending' as const,
    }] : []),
    {
      id: 'analyzing',
      label: 'AI Content Analysis',
      status: 'pending' as const,
    },
  ];

  const updateProgressStep = (stepId: string, updates: Partial<ProgressStep>) => {
    setProgressSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, ...updates } : step
    ));
  };

  const handleRealtimeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!postUrl.trim() || !requirements.trim()) {
      setError('Please provide both an Instagram URL and requirements.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResults(null);
    setOverallProgress(0);
    setProgressSteps(initializeProgressSteps());

    // Close any existing EventSource
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    try {

      // Since EventSource only supports GET, we'll need to make a POST request manually
      // and then parse the stream
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
               handleProgressUpdate(data);
             } catch {
               console.warn('Failed to parse SSE data:', line);
             }
           }
        }
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      setProgressSteps(prev => prev.map(step => ({ ...step, status: 'error' as const })));
    } finally {
      setIsLoading(false);
    }
  };

  const handleProgressUpdate = (update: ProgressUpdate) => {
    console.log('Progress update:', update);
    
    setOverallProgress(update.progress);

    // Update the current step
    if (update.step !== 'error' && update.step !== 'complete') {
      updateProgressStep(update.step, {
        status: 'active',
        message: update.message,
        progress: update.progress,
      });

      // Mark previous steps as completed
      const stepOrder = ['validating', 'fetching', 'transcribing', 'analyzing'];
      const currentIndex = stepOrder.indexOf(update.step);
      
      for (let i = 0; i < currentIndex; i++) {
        updateProgressStep(stepOrder[i], { status: 'completed' });
      }
    }

    // Handle completion
    if (update.step === 'complete' && update.data) {
      setResults(update.data as ApiResponse);
      setProgressSteps(prev => prev.map(step => ({ ...step, status: 'completed' as const })));
    }

    // Handle errors
    if (update.step === 'error') {
      setError(update.error || 'An error occurred');
      setProgressSteps(prev => prev.map(step => ({ 
        ...step, 
        status: step.status === 'active' ? 'error' as const : step.status 
      })));
    }

    // Update progress steps based on fetched data
    if (update.step === 'fetching' && update.data && typeof update.data === 'object' && 'mediaType' in update.data && update.data.mediaType === 'video') {
      setProgressSteps(initializeProgressSteps(true));
    }
  };

  const handleLegacySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!postUrl.trim() || !requirements.trim()) {
      setError('Please provide both an Instagram URL and requirements.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResults(null);
    setProgressSteps([]);
    setOverallProgress(0);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          postUrl: postUrl.trim(),
          requirements: requirements.trim(),
        }),
      });

      const data: ApiResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze post');
      }

      setResults(data);
      setOverallProgress(100);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = useRealTime ? handleRealtimeSubmit : handleLegacySubmit;

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Instagram className="h-8 w-8 text-purple-600" />
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
              Instagram Content Compliance Checker
            </h1>
          </div>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Analyze Instagram posts and stories against your custom requirements
          </p>
        </div>

        {/* Main Form */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Analyze Instagram Content</CardTitle>
            <CardDescription>
              Enter an Instagram post or story URL and your analysis requirements
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="postUrl" className="block text-sm font-medium mb-2">
                  Instagram Post/Story URL
                </label>
                <Input
                  id="postUrl"
                  type="url"
                  placeholder="https://www.instagram.com/p/..."
                  value={postUrl}
                  onChange={(e) => setPostUrl(e.target.value)}
                  className="w-full"
                />
              </div>

              <div>
                <label htmlFor="requirements" className="block text-sm font-medium mb-2">
                  Analysis Requirements (one per line)
                </label>
                <Textarea
                  id="requirements"
                  placeholder={`Example requirements:
#ad hashtag should appear above the fold
Mentions discount code in the first 10 seconds
Caption contains product name
Says "sponsored" in the audio`}
                  value={requirements}
                  onChange={(e) => setRequirements(e.target.value)}
                  className="w-full min-h-[120px]"
                />
              </div>

              {/* Real-time toggle */}
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="realtime"
                  checked={useRealTime}
                  onChange={(e) => setUseRealTime(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <label htmlFor="realtime" className="text-sm text-gray-700 dark:text-gray-300">
                  Enable real-time progress updates
                </label>
              </div>

              <Button 
                type="submit" 
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {useRealTime ? 'Processing...' : 'Analyzing...'}
                  </>
                ) : (
                  'Analyze Content'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Real-time Progress Indicator */}
        {useRealTime && isLoading && progressSteps.length > 0 && (
          <ProgressIndicator
            steps={progressSteps}
            overallProgress={overallProgress}
            className="mb-8"
          />
        )}

        {/* Error Display */}
        {error && (
          <Alert className="mb-8 border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800 dark:text-red-200">
              {error}
            </AlertDescription>
          </Alert>
        )}

        {/* Results Display */}
        {results && results.success && results.analysis && (
          <div className="space-y-6">
            {/* Overall Score */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Analysis Results
                  <span className={`text-2xl font-bold ${getScoreColor(results.analysis.overallScore)}`}>
                    {results.analysis.overallScore}%
                  </span>
                </CardTitle>
                <CardDescription>
                  {results.analysis.results.filter(r => r.passed).length} of {results.analysis.results.length} requirements passed
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Individual Results */}
            <div className="space-y-4">
              {results.analysis.results.map((result, index) => (
                <Card key={index} className={`border-l-4 ${
                  result.passed 
                    ? 'border-l-green-500 bg-green-50 dark:bg-green-900/20' 
                    : 'border-l-red-500 bg-red-50 dark:bg-red-900/20'
                }`}>
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-3">
                      {result.passed ? (
                        <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                      )}
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900 dark:text-white mb-1">
                          {result.requirement}
                        </h3>
                        <p className={`text-sm ${
                          result.passed 
                            ? 'text-green-700 dark:text-green-300' 
                            : 'text-red-700 dark:text-red-300'
                        }`}>
                          {result.explanation}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Post Preview */}
            {results.postData && (
              <Card>
                <CardHeader>
                  <CardTitle>Post Preview</CardTitle>
                  <CardDescription>
                    Media Type: {results.postData.mediaType}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                    <h4 className="font-medium mb-2">Caption:</h4>
                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                      {results.postData.caption}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
