"""
Generate placeholder icons for Tauri app
"""
from PIL import Image, ImageDraw, ImageFont
import os

def create_icon(size, filename):
    """Create a simple placeholder icon"""
    # Create image with blue background
    img = Image.new('RGBA', (size, size), color=(59, 130, 246, 255))
    draw = ImageDraw.Draw(img)
    
    # Draw a simple "Py" text
    try:
        # Try to use a system font
        font_size = size // 3
        font = ImageFont.truetype("arial.ttf", font_size)
    except:
        font = ImageFont.load_default()
    
    # Draw white circle
    margin = size // 8
    draw.ellipse([margin, margin, size-margin, size-margin], fill=(255, 255, 255, 200))
    
    # Draw "Py" text in blue
    text = "Py"
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    x = (size - text_width) // 2
    y = (size - text_height) // 2
    draw.text((x, y), text, fill=(59, 130, 246, 255), font=font)
    
    # Save as PNG
    img.save(filename, 'PNG')
    print(f"Created {filename} ({size}x{size})")

def create_ico():
    """Create Windows ICO file with multiple sizes"""
    sizes = [16, 32, 48, 64, 128, 256]
    images = []
    
    for size in sizes:
        img = Image.new('RGBA', (size, size), color=(59, 130, 246, 255))
        draw = ImageDraw.Draw(img)
        
        # Draw white circle
        margin = size // 8
        draw.ellipse([margin, margin, size-margin, size-margin], fill=(255, 255, 255, 200))
        
        # Draw "Py" text
        try:
            font_size = size // 3
            font = ImageFont.truetype("arial.ttf", font_size)
        except:
            font = ImageFont.load_default()
        
        text = "Py"
        bbox = draw.textbbox((0, 0), text, font=font)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]
        x = (size - text_width) // 2
        y = (size - text_height) // 2
        draw.text((x, y), text, fill=(59, 130, 246, 255), font=font)
        
        images.append(img)
    
    # Save as ICO
    ico_path = os.path.join(os.path.dirname(__file__), 'icons', 'icon.ico')
    images[0].save(ico_path, format='ICO', sizes=[(img.size[0], img.size[1]) for img in images])
    print(f"Created {ico_path}")

if __name__ == '__main__':
    # Use the directory where this script is located
    script_dir = os.path.dirname(os.path.abspath(__file__))
    icons_dir = os.path.join(script_dir, 'apps', 'desktop', 'src-tauri', 'icons')
    os.makedirs(icons_dir, exist_ok=True)
    
    # Create PNG icons
    create_icon(32, os.path.join(icons_dir, '32x32.png'))
    create_icon(128, os.path.join(icons_dir, '128x128.png'))
    create_icon(256, os.path.join(icons_dir, '128x128@2x.png'))
    
    # Create ICO file
    ico_path = os.path.join(icons_dir, 'icon.ico')
    images = []
    for size in [16, 32, 48, 64, 128, 256]:
        img = Image.new('RGBA', (size, size), color=(59, 130, 246, 255))
        draw = ImageDraw.Draw(img)
        margin = size // 8
        draw.ellipse([margin, margin, size-margin, size-margin], fill=(255, 255, 255, 200))
        try:
            font_size = size // 3
            font = ImageFont.truetype("arial.ttf", font_size)
        except:
            font = ImageFont.load_default()
        text = "Py"
        bbox = draw.textbbox((0, 0), text, font=font)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]
        x = (size - text_width) // 2
        y = (size - text_height) // 2
        draw.text((x, y), text, fill=(59, 130, 246, 255), font=font)
        images.append(img)
    images[0].save(ico_path, format='ICO', sizes=[(img.size[0], img.size[1]) for img in images])
    print(f"Created {ico_path}")
    
    # Create ICNS placeholder (just copy PNG for now, macOS will handle it)
    import shutil
    shutil.copy2(os.path.join(icons_dir, '128x128.png'), os.path.join(icons_dir, 'icon.icns'))
    print("Created icon.icns (placeholder)")
    
    print("\nAll icons created successfully!")
