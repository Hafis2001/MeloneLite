import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

/**
 * Service to generate AI images based on item name and category.
 * Uses pollinations.ai for free AI image generation (no API key required).
 */
export const generateAIImage = async (itemName: string, categoryName: string): Promise<string | null> => {
  if (!itemName.trim()) return null;

  try {
    // To guarantee we get exactly what the user typed, even with typos like "avacado",
    // we use the Bing Image Search Thumbnail API. This performs a real web search and returns
    // the top image result for the query, completely bypassing all AI generator rate limits!
    
    let searchQuery = itemName;
    if (categoryName && categoryName.trim()) {
      searchQuery = `${itemName} ${categoryName}`;
    }

    // Optional: Add "food" to ensure we get food photography
    searchQuery += ' food high quality';

    const imageUrl = `https://tse2.mm.bing.net/th?q=${encodeURIComponent(searchQuery)}&w=500&h=500&c=7&rs=1&p=0&dpr=3&pid=1.7&mkt=en-US&adlt=moderate`;

    console.log('Fetching Bing Image Search Result:', imageUrl);
    
    // Download the image locally to avoid React Native Image silently failing on 402/rate-limits
    const fileUri = FileSystem.documentDirectory + `menu_img_${Date.now()}.jpg`;
    const downloadRes = await FileSystem.downloadAsync(imageUrl, fileUri, {
      headers: {
        'User-Agent': 'MeloneLitePOSApp/1.0 (contact@melonelite.com)'
      }
    });
    
    if (downloadRes.status !== 200) {
      console.log('Image Download Failed Status:', downloadRes.status);
      return null;
    }

    return downloadRes.uri;
  } catch (error) {
    console.error('AI Image Generation Error:', error);
    return null;
  }
};
