# Chinese Stroke Order Animator

A minimal, working implementation of Chinese character stroke order animation.

## Features (Working)

✅ **Part 1**: Load and display any Chinese character  
✅ **Part 2**: Animate stroke order with Play/Stop  
✅ **Part 3**: Navigate strokes one by one (Previous/Next)  
✅ **Part 4**: Reset character and Loop animation  

## Usage

1. Open `index.html` in a browser
2. Enter a Chinese character (e.g., 永，你，好)
3. Click **Load** or press Enter
4. Use the controls:
   - **Animate** - Play stroke order animation
   - **Prev/Next** - Navigate stroke by stroke
   - **Reset** - Return to initial state
   - **Loop** - Repeat animation continuously

## Technical Notes

- Uses [HanziWriter](https://hanziwriter.org/) v3.5 for rendering
- Character data loaded from jsDelivr CDN
- No build step required - pure HTML/CSS/JS

## Next Steps (To Be Added)

- [ ] Speed control
- [ ] Display options (outline, grid, medians)
- [ ] Quiz mode
- [ ] Theme toggle (dark/light)
- [ ] Recent characters history
- [ ] Simplified/Traditional conversion

## File Structure

```
ChineseCharacterAnimator/
├── index.html      # Main HTML
├── style.css       # Styles
├── app.js          # Application logic
└── README.md       # This file
```
