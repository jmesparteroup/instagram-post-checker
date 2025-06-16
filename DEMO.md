# Instagram Content Checker - Demo

## How to Test the Application

1. **Set up Apify API Key** (Optional - will use mock data if not provided)
   - Create a `.env.local` file in the root directory
   - Add: `APIFY_API_KEY=your_apify_api_key_here`
   - Get your API key from [Apify Console](https://console.apify.com/account/integrations)

2. **Start the Development Server**
   ```bash
   npm run dev
   ```
   
3. **Open your browser** to `http://localhost:3000`

4. **Test with Real Instagram URLs**

### Example 1: Basic Compliance Check

**Instagram URL:** (Use any real Instagram post URL)
```
https://www.instagram.com/p/C7xBALsvCAi/
```

**Requirements (paste into textarea):**
```
#ad hashtag should appear above the fold
Mentions discount code in the first 10 seconds
Caption contains Sneak Eats
Says protein in the audio
```

**Expected Results:**
- ✅ `#ad hashtag should appear above the fold` - **PASS** (found in first 150 characters)
- ❌ `Mentions discount code in the first 10 seconds` - **FAIL** (not mentioned early enough)
- ✅ `Caption contains Sneak Eats` - **PASS** (found in caption)
- ✅ `Says protein in the audio` - **PASS** (mentioned in transcript)

**Overall Score:** 75%

### Example 2: Hashtag Analysis

**Instagram URL:** (Use any real Instagram post URL)
```
https://www.instagram.com/p/DCZlEDqy2to/
```

**Requirements:**
```
#sponsored hashtag in caption
#fitness hashtag above the fold
Contains #ad hashtag
```

**Expected Results:**
- ✅ `#sponsored hashtag in caption` - **PASS**
- ❌ `#fitness hashtag above the fold` - **FAIL** (appears later in caption)
- ✅ `Contains #ad hashtag` - **PASS**

**Overall Score:** 67%

### Example 3: Audio/Transcript Analysis

**Instagram URL:** (Use any real Instagram reel URL)
```
https://www.instagram.com/reel/DDIJAfeyemG/
```

**Requirements:**
```
Mentions "incredible" in the audio
Says "discount code" in first 10 seconds
Audio mentions "chocolate chip"
Speaks about "post-workout"
```

**Expected Results:**
- ✅ `Mentions "incredible" in the audio` - **PASS**
- ❌ `Says "discount code" in first 10 seconds` - **FAIL**
- ✅ `Audio mentions "chocolate chip"` - **PASS**
- ✅ `Speaks about "post-workout"` - **PASS**

**Overall Score:** 75%

## Understanding the Data Sources

The application now uses **real Instagram data** via Apify API, with intelligent fallback to mock data:

### Real Data (with Apify API Key):
- Fetches actual Instagram post captions, hashtags, and metadata
- Supports both posts and reels
- Generates smart mock transcripts based on actual caption content

### Mock Data (fallback when no API key or API fails):
The application falls back to mock data that simulates a typical sponsored Instagram post:

### Mock Caption:
```
🔥 Just tried the new Sneak Eats protein bars and they're incredible! The chocolate chip flavor is my absolute favorite. Perfect for post-workout fuel! 💪 

Use my code SAVE20 for 20% off your first order. Link in bio! 

What's your go-to post-workout snack? Let me know in the comments! 👇

#ad #sneakeats #proteinbar #fitness #postworkout #healthyeating #sponsored #fitnessmotivation #nutrition #gains
```

### Mock Transcript:
```
Hey everyone, welcome back to my channel! Today I'm super excited to share with you guys these amazing new protein bars from Sneak Eats. I've been testing them out for the past two weeks and honestly, they are incredible. The chocolate chip flavor is absolutely my favorite - it tastes like a dessert but it's actually packed with 20 grams of protein. Perfect for after my workouts. I've been having one right after I hit the gym and it keeps me satisfied for hours. The texture is so good too, not chalky at all like some other protein bars I've tried. If you guys want to try them out, I have a special discount code for you - it's SAVE20 and it'll get you 20% off your first order. The link is in my bio. Seriously, these are game changers for anyone who's into fitness or just wants a healthy snack option. Let me know in the comments what your favorite post-workout snack is!
```

## Analysis Logic

The system analyzes requirements using intelligent keyword detection:

### Hashtag Detection
- Looks for exact hashtag matches (e.g., `#ad`, `#sponsored`)
- Checks position in caption for "above the fold" requirements
- Case-insensitive matching

### Position-Based Analysis
- "Above the fold" = first 150 characters of caption
- "Beginning" = same as above the fold
- "First 10 seconds" = first ~50 words of transcript

### Content Analysis
- Searches both caption and transcript for keywords
- Removes stop words for better matching
- Provides specific location feedback (caption vs. audio)

## Tips for Testing

1. **Try Different Requirement Formats:**
   - `#ad hashtag above the fold`
   - `Contains #sponsored`
   - `Mentions discount code`
   - `Says "protein" in audio`

2. **Test Edge Cases:**
   - Empty requirements
   - Invalid Instagram URLs
   - Very specific vs. general requirements

3. **Observe the Explanations:**
   - Each result includes a detailed explanation
   - Helps understand why requirements passed or failed

## Next Steps

To enhance the application further:

1. **Add Speech-to-Text** for real video transcripts (OpenAI Whisper, Google Speech-to-Text)
2. **Implement Caching** to reduce API costs and improve performance
3. **Add Batch Processing** for multiple URLs at once
4. **Enhanced Error Handling** with retry logic and better user feedback
5. **Real-time Monitoring** for compliance tracking over time

## API Costs and Usage

- **Apify Instagram Scraper**: ~$1.50 per 1,000 results
- **Free Tier**: Apify provides free credits for testing
- **Fallback**: Application works without API key using mock data
- **Optimization**: Consider caching results to minimize API calls 