# D&D 5e Summons Assistant

A web application to help D&D players (particularly Druids) track and utilize summoned creatures during gameplay.

## Project Overview

This tool connects to D&D 5e resources, provides intuitive creature selection, and facilitates combat management with summoned creatures.

### Core Features

- Search and filter summonable creatures from the D&D 5e bestiary
- Track enemies with varying levels of known information
- Visual combat interface with drag-and-drop token system
- Automatic attack roll and damage calculation following D&D 5e rules
- Offline functionality with local data storage

## Setup Instructions

1. Clone this repository to your local machine
2. Open the project folder in Visual Studio Code
3. Use the Live Server extension to run the application
4. On first run, upload bestiary JSON files when prompted (sample files included in `/data/bestiary`)
5. Once data is loaded, explore the various features through the interface

## Data Management

The application can load creature data from JSON files in the 5etools format. Two options are available:

1. **Use Included Sample Data**: The repository includes sample bestiary files in `/data/bestiary` with common beasts that can be used for testing and development.

2. **Upload Your Own Data**: You can upload JSON files from the 5etools GitHub repository or other compatible sources through the application's upload interface.

All data is processed and stored in your browser's local storage for offline access.

## Modules Implemented

### Module 1: Basic Project Setup
- Project structure and repository setup
- Basic UI framework
- Initial stylesheet and JavaScript

### Module 2: Data Manager
- File upload interface for bestiary data
- JSON processing and data extraction
- Local storage implementation
- Basic creature search functionality

## Technical Information

- Built with vanilla JavaScript, HTML, and CSS
- Uses ES modules for code organization
- Uses browser's localStorage for offline data access
- Works as a local webpage without requiring internet after initial setup

## Development Status

This project is currently under active development. Features are being implemented incrementally according to the development plan.

## License

This project is for personal use only and is not affiliated with Wizards of the Coast.