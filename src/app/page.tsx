'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, XCircle, Loader2, Instagram, AlertCircle } from 'lucide-react';
import ProgressIndicator, { ProgressStep } from '@/components/ui/progress-indicator';
import { useAnalyzePost } from '@/hooks/useAnalyzePost';
import { useAnalyzePostStream } from '@/hooks/useAnalyzePostStream';

interface AnalysisResult {
  requirement: string;
  passed: boolean;
  explanation: string;
}

interface ApiResponse {
  success: boolean;
  postData?: {
    caption: string;
    mediaType: string;
    mediaUrl: string;
  };
  analysis?: {
    results: AnalysisResult[];
    overallScore: number;
    aiPowered: boolean;
    processingTime: number;
    model: string;
  };
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
  const [useRealTime, setUseRealTime] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Real-time progress state
  const [progressSteps, setProgressSteps] = useState<ProgressStep[]>([]);
  const [overallProgress, setOverallProgress] = useState(0);

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

  const handleProgressUpdate = (update: ProgressUpdate) => {
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

  // Regular analysis mutation
  const analyzeMutation = useAnalyzePost();

  // Real-time analysis mutation
  const analyzeStreamMutation = useAnalyzePostStream();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!postUrl.trim() || !requirements.trim()) {
      setError('Please provide both an Instagram URL and requirements.');
      return;
    }

    setError(null);
    setOverallProgress(0);

    if (useRealTime) {
      setProgressSteps(initializeProgressSteps());
      analyzeStreamMutation.mutate(
        { 
          postUrl: postUrl.trim(), 
          requirements: requirements.trim(),
          onProgress: handleProgressUpdate
        }
      );
    } else {
      analyzeMutation.mutate({ 
        postUrl: postUrl.trim(), 
        requirements: requirements.trim() 
      });
    }
  };

  const isLoading = useRealTime ? analyzeStreamMutation.isPending : analyzeMutation.isPending;
  const results = useRealTime ? analyzeStreamMutation.data as ApiResponse : analyzeMutation.data;
  const mutationError = useRealTime ? analyzeStreamMutation.error : analyzeMutation.error;

  useEffect(() => {
    if (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : 'An unexpected error occurred');
    }
  }, [mutationError]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <main className="container mx-auto p-4 md:p-8 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Instagram className="h-6 w-6" />
            Instagram Content Checker
          </CardTitle>
          <CardDescription>
            Analyze Instagram posts and reels for compliance with your requirements
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="postUrl" className="text-sm font-medium">
                Instagram Post URL
              </label>
              <Input
                id="postUrl"
                value={postUrl}
                onChange={(e) => setPostUrl(e.target.value)}
                placeholder="https://www.instagram.com/p/... or /reel/... or /username/reel/..."
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="requirements" className="text-sm font-medium">
                Requirements (one per line)
              </label>
              <Textarea
                id="requirements"
                value={requirements}
                onChange={(e) => setRequirements(e.target.value)}
                placeholder="#ad hashtag should appear above the fold&#10;Mentions discount code in the first 10 seconds&#10;Caption contains product name"
                className="min-h-[100px]"
                disabled={isLoading}
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="realtime"
                checked={useRealTime}
                onChange={(e) => setUseRealTime(e.target.checked)}
                disabled={isLoading}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="realtime" className="text-sm">
                Use real-time progress updates
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
          className="my-8"
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
        <div className="space-y-8 mt-8">
          {/* Post Data */}
          <Card>
            <CardHeader>
              <CardTitle>Post Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium">Caption</h4>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-300">
                    {results.postData?.caption}
                  </p>
                </div>
                <div>
                  <h4 className="font-medium">Media Type</h4>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                    {results.postData?.mediaType}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Analysis Results */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Analysis Results
                <span className={`text-xl ${getScoreColor(results.analysis.overallScore)}`}>
                  {results.analysis.overallScore}%
                </span>
              </CardTitle>
              <CardDescription>
                {results.analysis.aiPowered ? (
                  <>
                    AI-powered analysis completed in {results.analysis.processingTime.toFixed(2)}ms using {results.analysis.model}
                  </>
                ) : (
                  'Rule-based analysis completed'
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {results.analysis.results.map((result, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 rounded-lg border p-4"
                  >
                    {result.passed ? (
                      <CheckCircle className="h-5 w-5 flex-shrink-0 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 flex-shrink-0 text-red-500" />
                    )}
                    <div>
                      <p className="font-medium">{result.requirement}</p>
                      <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                        {result.explanation}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </main>
  );
}
