# Changelog

All notable changes to the Variant Organizer plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-12-19

### Added
- Initial release of Variant Organizer plugin
- Automatic organization of component variants into structured tables
- Smart property detection and value extraction
- Intelligent grouping for multiple variant properties
- Dark mode context detection and styling
- State-aware variant sorting (default, hover, focus, disabled)
- Visual grid layout with clear property organization
- Missing variant combination detection with visual indicators
- Support for Figma, FigJam, and Figma Slides
- Responsive UI with modern styling

### Features
- **Core Organization**: Converts messy component variants into clean, structured tables
- **Property Detection**: Automatically identifies variant properties and their values
- **Smart Grouping**: Groups variants by multiple properties for better organization
- **Context Awareness**: Automatically detects and styles dark mode variants
- **State Ordering**: Intelligently orders state-based variants
- **Visual Grid**: Creates clear matrix showing all variant combinations
- **Missing Detection**: Highlights incomplete variant combinations

### Technical
- Built with TypeScript for type safety
- Uses Figma Plugin API 1.0.0
- No external network dependencies
- Dynamic page access for component manipulation
- Responsive UI with CSS Grid and Flexbox
- Error handling and user notifications

## [1.0.1] - 2024-12-19

### Added
- Enhanced icon detection through component structure analysis
- Component property pattern detection for boolean properties
- Improved component name-based property detection

### Documentation
- **Important**: Added Figma Plugin API limitations documentation
- Clarified that component properties (boolean, text) are not accessible via Plugin API
- Added workarounds for component properties using variant properties
- Enhanced troubleshooting guide for common property detection issues

### Known Limitations
- Component properties like "Has left icon?" cannot be directly accessed
- Plugin works best with variant properties rather than component properties
- Boolean properties set through Figma's component properties panel are not supported
- Appearance mode settings in variables or components cannot be changed or detected
- Dynamic properties controlled by Figma variables are not accessible

### Workarounds Added
- Convert component properties to variant properties for full support
- Use naming conventions to include property information in component names
- Structure-based detection through child element naming

## [Unreleased]

### Planned Features
- Export organized variants to different formats
- Custom property ordering preferences
- Template-based organization layouts
- Batch processing for multiple component sets
- Integration with design system documentation tools
- Better detection methods for component properties (if API allows in future)

### Improvements
- Performance optimization for large component sets
- Enhanced dark mode detection algorithms
- More flexible property grouping options
- Accessibility improvements for the UI
- Internationalization support

---

## Version History

- **1.0.1**: Enhanced icon detection, API limitations documentation, component property workarounds
- **1.0.0**: Initial release with core variant organization functionality
