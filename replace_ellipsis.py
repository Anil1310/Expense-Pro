import os
import re

files = [
    "/Users/anilkumarchahar/Desktop/Expense Pro/Expense Tracker/Script.html",
    "/Users/anilkumarchahar/Desktop/Expense Pro/Layout/Index.html",
    "/Users/anilkumarchahar/Desktop/Expense Pro/Layout/Layout.html"
]

for file_path in files:
    if os.path.exists(file_path):
        with open(file_path, "r") as f:
            content = f.read()
        
        # Replace occurrences of '...",' or '...");' inside showAlert or generally where it has ...
        new_content = re.sub(r'showAlert\("(.*?)\.\.\.",', r'showAlert("\1",', content)
        new_content = re.sub(r'showAlert\("(.*?)\.\.\."\);', r'showAlert("\1");', new_content)
        
        with open(file_path, "w") as f:
            f.write(new_content)
        print(f"Updated {file_path}")
