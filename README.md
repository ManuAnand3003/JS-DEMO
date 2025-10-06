# Canvas Particles & Creatures Demo

This is a lightweight, zero-dependency canvas demonstration showcasing a particle system and several interactive, procedurally animated creatures that follow the user's cursor.

**[Live Demo - Link Here]** <!-- TODO: Add a link to the live demo -->

## Features

- **Interactive Particle System**: Click and drag to create streams of particles.
- **Multiple Animated Creatures**: Switch between different entities, each with unique movement and rendering logic.
- **Procedural Animation**: All creature movements, including skeletons, limbs, and wings, are animated procedurally.
- **UI Controls**: A simple UI allows for real-time adjustment of creature/particle speed and particle count.

## Files

- `demo.html`: The main HTML file for the application.
- `demo.css`: All styles for the layout and controls.
- `demo.js`: The core logic, including the particle system, all entity classes (Snake, Dragon, etc.), and UI controls.

## How to Run

This project consists of static HTML, CSS, and JavaScript files and is best run with a local web server to avoid potential browser security restrictions.

If you are using VS Code, the **Live Server** extension is a great option:

1.  Open the project folder in VS Code.
2.  If you don't have it, install the Live Server extension.
3.  Right-click `demo.html` in the file explorer and choose "Open with Live Server".

## Interaction

The controls are located in the translucent sidebar on the left.

- **Entity Selector**: Use the dropdown menu to choose which creature to display on the canvas. Options include `Snake`, `Fish`, `Koi`, `Centipede`, and `Dragon`. Selecting `None` will show only the background particles.
- **Pointer Control**: The selected creature will follow your cursor (or touch point) around the canvas.
- **Particle Spawning**: Clicking and holding the mouse button will spawn a stream of background particles from the cursor's position.
- **Count Slider**: Adjusts the number of particles spawned when you click and hold the mouse.
- **Speed Slider**: Controls the movement speed of both the active creature and all particles.
- **Clear Button**: Removes all particles from the canvas.

## Notes

- This project is written in vanilla JavaScript (ES6+) and is designed to work in all modern web browsers.
- The code was recently refactored to use a base `SkeletalEntity` class to reduce code duplication between the snake, centipede, and dragon.
