// Curated starter vocabularies for entity extraction. These are NOT inserted
// into the database — they only widen what `matchEntities` can recognise so
// scanning is useful before you've built up your own ingredients/tags. A seeded
// name becomes a real DB row only when a recipe that uses it is saved (via
// resolveIngredients/resolveTagIds), so the ingredient/tag filters never fill
// up with unused entries. The live DB vocabulary is unioned on top at runtime.

/** ~160 common cooking ingredients (singular; the matcher tolerates plurals). */
export const COMMON_INGREDIENTS: string[] = [
  // Produce
  "Tomato", "Onion", "Red onion", "Garlic", "Potato", "Sweet potato", "Carrot",
  "Celery", "Bell pepper", "Pepper", "Chili", "Jalapeno", "Cucumber", "Lettuce",
  "Spinach", "Kale", "Broccoli", "Cauliflower", "Cabbage", "Zucchini",
  "Eggplant", "Mushroom", "Corn", "Pea", "Green bean", "Asparagus", "Avocado",
  "Lemon", "Lime", "Orange", "Apple", "Banana", "Strawberry", "Blueberry",
  "Raspberry", "Mango", "Pineapple", "Ginger", "Leek", "Shallot", "Scallion",
  "Spring onion", "Parsley", "Cilantro", "Basil", "Mint", "Rosemary", "Thyme",
  "Oregano", "Sage", "Dill", "Bay leaf",
  // Pantry & staples
  "Flour", "Sugar", "Brown sugar", "Powdered sugar", "Salt", "Black pepper",
  "Baking soda", "Baking powder", "Yeast", "Cornstarch", "Olive oil",
  "Vegetable oil", "Sunflower oil", "Sesame oil", "Coconut oil", "Butter",
  "Vinegar", "Balsamic vinegar", "Soy sauce", "Fish sauce",
  "Worcestershire sauce", "Honey", "Maple syrup", "Vanilla", "Vanilla extract",
  "Cocoa powder", "Chocolate", "Dark chocolate", "Tomato paste", "Tomato sauce",
  "Stock", "Broth", "Chicken stock", "Vegetable stock", "Coconut milk",
  "Breadcrumbs", "Oats", "Rice", "Brown rice", "Basmati rice", "Pasta",
  "Spaghetti", "Noodle", "Quinoa", "Couscous", "Lentil", "Chickpea",
  "Black bean", "Kidney bean", "White bean",
  // Dairy & eggs
  "Egg", "Milk", "Cream", "Heavy cream", "Sour cream", "Yogurt", "Greek yogurt",
  "Cheese", "Cheddar", "Parmesan", "Mozzarella", "Feta", "Cream cheese",
  "Ricotta",
  // Proteins
  "Chicken", "Chicken breast", "Chicken thigh", "Beef", "Ground beef", "Steak",
  "Pork", "Bacon", "Ham", "Sausage", "Lamb", "Turkey", "Fish", "Salmon", "Tuna",
  "Cod", "Shrimp", "Prawn", "Tofu", "Tempeh",
  // Spices & condiments
  "Cumin", "Coriander", "Paprika", "Smoked paprika", "Turmeric", "Cinnamon",
  "Nutmeg", "Cardamom", "Clove", "Curry powder", "Chili powder", "Cayenne",
  "Red pepper flakes", "Garlic powder", "Onion powder", "Mustard",
  "Dijon mustard", "Ketchup", "Mayonnaise",
  // Nuts & seeds
  "Almond", "Walnut", "Cashew", "Peanut", "Peanut butter", "Pecan", "Pine nut",
  "Sesame seed", "Sunflower seed", "Chia seed", "Flax seed",
];

/** Common recipe tags. Only matched when they appear verbatim in the text. */
export const COMMON_TAGS: string[] = [
  "Breakfast", "Brunch", "Lunch", "Dinner", "Dessert", "Snack", "Appetizer",
  "Side dish", "Main course", "Soup", "Salad", "Stew", "Curry", "Stir fry",
  "Casserole", "Bake", "Grill", "Roast", "Barbecue", "Vegetarian", "Vegan",
  "Gluten-free", "Dairy-free", "Low carb", "Keto", "Healthy", "Quick", "Easy",
  "Comfort food", "Spicy", "Sweet", "Savory", "Italian", "Mexican", "Indian",
  "Chinese", "Thai", "Japanese", "French", "Mediterranean", "Greek", "American",
  "Bread", "Pasta", "Pizza", "Sandwich", "Smoothie", "Drink", "Cocktail",
  "Sauce", "Seafood", "Holiday",
];
