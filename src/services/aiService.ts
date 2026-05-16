import { Platform } from 'react-native';

/**
 * Service to generate AI images based on item name and category.
 * Uses pollinations.ai for free AI image generation (no API key required).
 */
export const generateAIImage = async (itemName: string, categoryName: string): Promise<string | null> => {
  if (!itemName.trim()) return null;

  try {
    // 1. Construct a smart prompt by combining name and category naturally
    // 1. Construct a very explicit prompt to ensure category is prioritized
    let fullDescription = itemName;
    const lowerCat = (categoryName || "").toLowerCase();
    const lowerName = itemName.toLowerCase();

    if (lowerCat.includes('juice') || lowerName.includes('juice')) {
      fullDescription = `A glass of fresh cold ${itemName.replace(/juice/gi, '')} juice with ice`;
    } else if (lowerCat.includes('tea') || lowerCat.includes('coffee') || lowerCat.includes('drink')) {
      fullDescription = `A cup of hot ${itemName} ${categoryName}`;
    } else if (categoryName) {
      fullDescription = `${itemName} ${categoryName} served on a plate`;
    }

    // Add context based on category
    let context = "professional food photography";
    if (lowerCat.includes('juice') || lowerCat.includes('drink')) {
      context = "refreshing drink, condensation on glass, gourmet cafe style";
    } else {
      context = "gourmet restaurant plating, high-end culinary presentation";
    }

    const prompt = encodeURIComponent(
      `${fullDescription}, ${context}, highly detailed, 4k, appetizing`
    );

    // Use the detailed prompt for higher accuracy instead of the ultra-fast one
    const seed = Math.floor(Math.random() * 9999);
    const imageUrl = `https://image.pollinations.ai/prompt/${prompt}?width=400&height=400&seed=${seed}&nologo=true&enhance=true`;

    console.log('AI Image (High Quality):', imageUrl);
    
    // In a real production app, you might want to download this to the local filesystem
    // using expo-file-system to ensure it works offline.
    return imageUrl;
  } catch (error) {
    console.error('AI Image Generation Error:', error);
    return null;
  }
};
