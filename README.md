# Variant Organizer

A powerful Figma plugin that automatically organizes component variants into structured, easy-to-read tables. Perfect for design systems and component libraries where you need to visualize all variant combinations at a glance.

## ✨ Features

- **Automatic Organization**: Converts messy component variants into clean, structured tables
- **Smart Property Detection**: Automatically identifies variant properties and their values
- **Intelligent Grouping**: Groups variants by multiple properties for better organization
- **Dark Mode Support**: Automatically detects and styles dark mode variants appropriately
- **State-Aware Sorting**: Intelligently orders state-based variants (default, hover, focus, disabled)
- **Visual Grid Layout**: Creates a clear matrix showing all variant combinations
- **Missing Variant Detection**: Highlights missing variant combinations with visual indicators

## 🚀 How to Use

1. **Select a Component**: Choose a Component, Instance, or Component Set in your Figma file
2. **Run the Plugin**: Click "Organize Variants" in the plugin panel
3. **View Results**: The plugin creates a structured table showing all your variants organized by properties

## 📋 Requirements

- Figma, FigJam, or Figma Slides
- Component Set with multiple variants
- Variants should have consistent property structures

## 🎯 Perfect For

- **Design Systems**: Organize button, input, and component variants
- **Component Libraries**: Create clear documentation of all available variants
- **Team Collaboration**: Help team members understand available component options
- **Design Reviews**: Present variants in an organized, easy-to-scan format
- **Developer Handoffs**: Provide clear visual reference for implementation

## 🔧 How It Works

The plugin analyzes your Component Set and:

1. **Extracts Properties**: Identifies all variant properties (size, state, theme, etc.)
2. **Detects Values**: Finds all possible values for each property
3. **Creates Grid**: Builds a table with properties as rows/columns
4. **Organizes Variants**: Places each variant in the appropriate grid cell
5. **Groups Complex Sets**: Handles multiple properties with intelligent grouping
6. **Applies Styling**: Uses appropriate colors and layouts for different contexts

## 📱 Supported Variant Types

- **Size Variants**: Small, Medium, Large
- **State Variants**: Default, Hover, Focus, Disabled
- **Theme Variants**: Light, Dark, On Dark
- **Content Variants**: With Icon, Without Icon, With Label
- **Any Custom Properties**: The plugin adapts to your naming conventions

## 🎨 Output Format

The plugin creates a structured frame containing:
- **Title**: Component Set name
- **Property Groups**: Organized by variant properties
- **Grid Layout**: Clear rows and columns for easy scanning
- **Visual Indicators**: Color coding for different contexts
- **Missing Variants**: Highlighted placeholders for incomplete combinations

## 💡 Tips for Best Results

1. **Consistent Naming**: Use consistent property names across your variants
2. **Complete Sets**: Ensure all logical variant combinations exist
3. **Clear Properties**: Use descriptive property names (e.g., "size" instead of "s")
4. **State Ordering**: The plugin automatically orders common states (default → hover → focus → disabled)

## 🛠️ Development

This plugin is built with:
- TypeScript for type safety
- Figma Plugin API for seamless integration
- Modern ES6+ features for clean, maintainable code

## 📄 License

MIT License - feel free to use, modify, and distribute as needed.

## 🤝 Contributing

Found a bug or have a feature request? Please open an issue or submit a pull request!

## 📞 Support

If you encounter any issues or have questions:
1. Check the [Figma Plugin Documentation](https://www.figma.com/plugin-docs/)
2. Review the plugin requirements above
3. Ensure your Component Set has proper variant structure

---

**Made with ❤️ for the Figma community**
