import { InstagramPostData } from './instagram-service';

export interface AnalysisResult {
  requirement: string;
  passed: boolean;
  explanation: string;
}

export interface AnalysisReport {
  results: AnalysisResult[];
  overallScore: number;
}

const ABOVE_THE_FOLD_CHAR_LIMIT = 150;
const FIRST_SECONDS_WORD_LIMIT = 50; // Approximate words in first 10 seconds of speech

/**
 * Analyzes Instagram post data against user-defined requirements
 */
export function analyzeContent(
  postData: InstagramPostData,
  requirements: string[]
): AnalysisReport {
  const results: AnalysisResult[] = [];

  for (const requirement of requirements) {
    const trimmedReq = requirement.trim();
    if (!trimmedReq) continue;

    const result = checkRequirement(postData, trimmedReq);
    results.push(result);
  }

  const passedCount = results.filter(r => r.passed).length;
  const overallScore = results.length > 0 ? Math.round((passedCount / results.length) * 100) : 0;

  return {
    results,
    overallScore
  };
}

function checkRequirement(postData: InstagramPostData, requirement: string): AnalysisResult {
  const lowerReq = requirement.toLowerCase();
  const { caption, transcript } = postData;

  // Check for hashtag requirements
  if (lowerReq.includes('#') || lowerReq.includes('hashtag')) {
    return checkHashtagRequirement(caption, requirement, lowerReq);
  }

  // Check for "above the fold" requirements (first 150 characters)
  if (lowerReq.includes('above the fold') || lowerReq.includes('beginning')) {
    return checkAboveFoldRequirement(caption, requirement, lowerReq);
  }

  // Check for audio/transcript requirements
  if (lowerReq.includes('mention') || lowerReq.includes('says') || lowerReq.includes('audio') || lowerReq.includes('speak')) {
    return checkTranscriptRequirement(transcript, requirement, lowerReq);
  }

  // Check for first seconds requirements
  if (lowerReq.includes('first') && (lowerReq.includes('second') || lowerReq.includes('10'))) {
    return checkFirstSecondsRequirement(transcript, requirement, lowerReq);
  }

  // Check for caption/description requirements
  if (lowerReq.includes('caption') || lowerReq.includes('description') || lowerReq.includes('text')) {
    return checkCaptionRequirement(caption, requirement, lowerReq);
  }

  // Default: check if requirement text appears anywhere in caption or transcript
  return checkGeneralRequirement(caption, transcript, requirement, lowerReq);
}

function checkHashtagRequirement(caption: string, requirement: string, lowerReq: string): AnalysisResult {
  // Extract hashtag from requirement
  const hashtagMatch = requirement.match(/#\w+/);
  if (!hashtagMatch) {
    // Look for hashtag keywords in requirement
    const keywords = extractKeywords(lowerReq);
    const found = keywords.some(keyword => 
      caption.toLowerCase().includes(`#${keyword}`) || 
      caption.toLowerCase().includes(keyword)
    );
    
    return {
      requirement,
      passed: found,
      explanation: found 
        ? `Pass: Found relevant hashtag content in the caption.`
        : `Fail: Could not find relevant hashtag content in the caption.`
    };
  }

  const hashtag = hashtagMatch[0].toLowerCase();
  const found = caption.toLowerCase().includes(hashtag);
  
  if (lowerReq.includes('above the fold') || lowerReq.includes('beginning')) {
    const aboveFoldText = caption.substring(0, ABOVE_THE_FOLD_CHAR_LIMIT).toLowerCase();
    const foundAboveFold = aboveFoldText.includes(hashtag);
    
    return {
      requirement,
      passed: foundAboveFold,
      explanation: foundAboveFold
        ? `Pass: '${hashtag}' found in the first ${ABOVE_THE_FOLD_CHAR_LIMIT} characters.`
        : `Fail: '${hashtag}' not found in the first ${ABOVE_THE_FOLD_CHAR_LIMIT} characters.`
    };
  }

  return {
    requirement,
    passed: found,
    explanation: found
      ? `Pass: '${hashtag}' found in the caption.`
      : `Fail: '${hashtag}' not found in the caption.`
  };
}

function checkAboveFoldRequirement(caption: string, requirement: string, lowerReq: string): AnalysisResult {
  const keywords = extractKeywords(lowerReq);
  const aboveFoldText = caption.substring(0, ABOVE_THE_FOLD_CHAR_LIMIT).toLowerCase();
  
  const found = keywords.some(keyword => aboveFoldText.includes(keyword));
  
  return {
    requirement,
    passed: found,
    explanation: found
      ? `Pass: Required content found in the first ${ABOVE_THE_FOLD_CHAR_LIMIT} characters.`
      : `Fail: Required content not found in the first ${ABOVE_THE_FOLD_CHAR_LIMIT} characters.`
  };
}

function checkTranscriptRequirement(transcript: string, requirement: string, lowerReq: string): AnalysisResult {
  const keywords = extractKeywords(lowerReq);
  const lowerTranscript = transcript.toLowerCase();
  
  const found = keywords.some(keyword => lowerTranscript.includes(keyword));
  
  return {
    requirement,
    passed: found,
    explanation: found
      ? `Pass: Required content mentioned in the audio/video.`
      : `Fail: Required content not mentioned in the audio/video.`
  };
}

function checkFirstSecondsRequirement(transcript: string, requirement: string, lowerReq: string): AnalysisResult {
  const keywords = extractKeywords(lowerReq);
  const firstWords = transcript.split(' ').slice(0, FIRST_SECONDS_WORD_LIMIT).join(' ').toLowerCase();
  
  const found = keywords.some(keyword => firstWords.includes(keyword));
  
  return {
    requirement,
    passed: found,
    explanation: found
      ? `Pass: Required content mentioned in the first 10 seconds.`
      : `Fail: Required content not mentioned in the first 10 seconds.`
  };
}

function checkCaptionRequirement(caption: string, requirement: string, lowerReq: string): AnalysisResult {
  const keywords = extractKeywords(lowerReq);
  const lowerCaption = caption.toLowerCase();
  
  const found = keywords.some(keyword => lowerCaption.includes(keyword));
  
  return {
    requirement,
    passed: found,
    explanation: found
      ? `Pass: Required content found in the caption.`
      : `Fail: Required content not found in the caption.`
  };
}

function checkGeneralRequirement(caption: string, transcript: string, requirement: string, lowerReq: string): AnalysisResult {
  const keywords = extractKeywords(lowerReq);
  const lowerCaption = caption.toLowerCase();
  const lowerTranscript = transcript.toLowerCase();
  
  const foundInCaption = keywords.some(keyword => lowerCaption.includes(keyword));
  const foundInTranscript = keywords.some(keyword => lowerTranscript.includes(keyword));
  const found = foundInCaption || foundInTranscript;
  
  let location = '';
  if (foundInCaption && foundInTranscript) {
    location = 'caption and audio';
  } else if (foundInCaption) {
    location = 'caption';
  } else if (foundInTranscript) {
    location = 'audio';
  }
  
  return {
    requirement,
    passed: found,
    explanation: found
      ? `Pass: Required content found in the ${location}.`
      : `Fail: Required content not found in the post.`
  };
}

function extractKeywords(text: string): string[] {
  // Remove common stop words and extract meaningful keywords
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
    'should', 'must', 'have', 'has', 'is', 'are', 'be', 'been', 'being', 'will', 'would',
    'above', 'fold', 'first', 'seconds', 'mention', 'mentions', 'says', 'said', 'caption',
    'description', 'text', 'hashtag', 'audio', 'video', 'beginning', 'contains', 'includes'
  ]);
  
  return text
    .split(/\s+/)
    .map(word => word.replace(/[^\w#]/g, '').toLowerCase())
    .filter(word => word.length > 2 && !stopWords.has(word))
    .filter(word => word !== '');
} 