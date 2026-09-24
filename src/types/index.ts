// ── Recipe types ─────────────────────────────────────────────

export interface Ingredient {
  name: string;
  amount: string;
  unit: string;
  optional: boolean;
}

export interface CookStep {
  stepNumber: number;
  instruction: string;
  durationMinutes: number;
  notificationMessage: string;
}

export interface Nutrition {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface Recipe {
  id: string;
  dishName: string;
  description: string;
  cuisine: string;
  difficulty: 'easy' | 'medium' | 'hard';
  prepTimeMinutes: number;
  cookTimeMinutes: number;
  servings: number;
  ingredients: Ingredient[];
  steps: CookStep[];
  tips: string[];
  nutrition: Nutrition;
}

// ── Substitution types ───────────────────────────────────────

export interface Substitution {
  original: string;
  substitute: string;
  amountAdjustment: string;
  tasteImpact: 'minimal' | 'moderate' | 'significant';
  note: string;
}

// ── User types ───────────────────────────────────────────────

export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  householdSize: number;
  dietaryPreferences: string[];
  allergies: string[];
  plan: 'free' | 'premium';
  recipeGensThisMonth: number;
  aiQuestionsThisMonth: number;
  fcmToken: string | null;
}

// ── API Request types ────────────────────────────────────────

export interface GenerateRecipeRequest {
  dishName: string;
  servings?: number;
}

export interface ScaleRecipeRequest {
  recipe: Recipe;
  newServings: number;
}

export interface SubstitutionRequest {
  ingredient: string;
  dishName: string;
  availableIngredients?: string[];
}

export interface AskQuestionRequest {
  question: string;
  conversationHistory?: ConversationMessage[];
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ScheduleNotificationRequest {
  userId: string;
  fcmToken: string;
  recipe: Recipe;
  cookStartTime: string;
}

// ── API Response types ───────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ── Auth types ───────────────────────────────────────────────

export interface AuthenticatedRequest extends Express.Request {
  user: UserProfile;
}
