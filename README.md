# D&D 5e Summons Assistant

A web application to help D&D players (particularly Druids) track and utilize summoned creatures during gameplay.

## Project Overview

This tool connects to D&D 5e resources, provides intuitive creature selection, and facilitates combat management with summoned creatures.

### Core Features

- Search and filter summonable creatures from the D&D 5e bestiary
- View complete, accurate statblocks including variants and templated creatures
- Track enemies with varying levels of known information
- Visual combat interface with drag-and-drop token system
- Automatic attack roll and damage calculation following D&D 5e rules
- Offline functionality with local data storage

## Setup Instructions

1. Clone this repository to your local machine
2. Open the project folder in Visual Studio Code
3. Use the Live Server extension to run the application
4. On first run, either load the included sample data or upload your own bestiary JSON files
5. Once data is loaded, explore the various features through the interface

## Data Management

The application can load creature data from JSON files in the 5etools format. Three options are available:

1. **Use Sample Data**: Click the "Load Sample Data" button to quickly load pre-processed sample creatures for testing and development.

2. **Upload Your Own Data**: Upload JSON files from the 5etools GitHub repository or other compatible sources through the application's upload interface.

3. **Import Previously Exported Data**: If you've previously exported data from the application, you can import it back using the Import button.

All data is processed and stored in your browser's IndexedDB storage for offline access.

## Statblock Rendering

The application features a comprehensive statblock renderer that:

- Displays complete, accurate D&D 5e creature statblocks
- Properly handles creature variants and templates (e.g., "Bestial Spirit" air/land/water variants)
- Accurately processes creatures that inherit from other creatures via `_copy` properties
- Correctly renders complex formatting tags for attacks, damage, and abilities
- Supports variable stats based on spell level and other parameters
- Provides an intuitive interface for selecting between creature variants

When viewing a creature with variants (like summoned spirits), you'll be presented with a selection screen to choose the specific variant you want to view.

## Modules Implemented

### Module 1: Basic Project Setup
- Project structure and repository setup
- Basic UI framework
- Initial stylesheet and JavaScript

### Module 2: Data Manager
- Enhanced data storage with IndexedDB implementation
- File upload interface for bestiary data
- Sample data loading feature
- JSON processing and data extraction with validation
- Data export/backup functionality
- Data statistics visualization
- Search functionality with proper formatting of challenge ratings
- Visual feedback for successful data operations

### Module 3: Creature Manager
- Comprehensive creature filtering and searching
- Detailed statblock display with D&D formatting
- Favorites management system
- Multiple view options for different creature types

### Module 4: Enhanced Statblock Renderer
- Complete and accurate creature statblock rendering
- Support for creature variants and templates
- Proper processing of complex bestiary data structures
- Advanced formatting of abilities, attacks, and traits
- Variant selection interface for multi-form creatures

## Technical Information

- Built with vanilla JavaScript, HTML, and CSS
- Uses ES modules for code organization
- Uses browser's IndexedDB for efficient offline data access
- Works as a local webpage without requiring internet after initial setup

## Data Storage Information

Your uploaded bestiary data is stored in your browser's IndexedDB storage. This data will be lost in the following cases:
- Clearing your browser's cache or site data
- Using private/incognito browsing mode
- Browser updates that affect storage
- Manually clicking the "Refresh Data" button

Once data is successfully uploaded, it will persist between sessions until one of these events occurs.

## Development Status

This project is currently under active development. Features are being implemented incrementally according to the development plan.

## License

This project is for personal use only and is not affiliated with Wizards of the Coast.