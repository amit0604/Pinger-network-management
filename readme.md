Check your python version using:
    python3 -m venv venv
    
    I am using Python 3.13.2

Step 1: Create Project Directory and Virtual Environment
-------------------------------------------------------- 
a. Create a project directory and navigate into it using your terminal:
    mkdir pinger
    cd pinger

b. Create a Python virtual environment to isolate your project's dependencies:
    python3 -m venv venv

c. Activate the virtual envirament:
    - on mac/linux:
        source venv/bin/activate

    - on windows:
        venv\\Scripts\\activate.bat

Step 2: Install Flask
--------------------------------------------------------
With your virtual environment activated, install Flask using pip, the Python package installer: 
    pip install flask

Step 3: Create a Basic Flask Application 
--------------------------------------------------------
a. Create a new file named "app.py" in your project directory using a text editor.

b. Add the following code to "app.py" to create a basic "Hello, World!" application:
    from flask import Flask
    app = Flask(__name__)

    @app.route('/')
    def hello_world():
        return '<h1>Hello, World!</h1>'

    if __name__ == '__main__':
        app.run(debug=True, host='0.0.0.0')

    - from flask import Flask imports the necessary class.
    - app = Flask(__name__) creates your application instance.
    - @app.route('/') is a decorator that maps the main URL route (/) to the hello_world function.
    - The if __name__ == '__main__': app.run(...) block ensures the server runs when the script is executed directly. 

Step 4: Run the Web Server 
--------------------------------------------------------
a. Set the flask application environment variable in your terminal to specify which file to run:
    - on mac/linux:
        export FLASK_APP=app

    - on windows:
        set FLASK_APP=app

b. Run the application using the flask run command:
    flask --app app.py run --debug        

c. Access your application by opening a web browser and navigating to the URL displayed in the terminal output, typically http://127.0.0.1:5000/

d. To stop the development server, press 'CTRL+C' in your terminal. 

Step 5: Run costume html page
--------------------------------------------------------
a. In the same directory as your "app.py" file, create a folder named "templates". Flask is configured to look for HTML template files in this specific folder name.
    mkdir templates

b. Add an HTML File:
Inside the templates folder, create your HTML files (e.g., index.html, base.html, etc.).
    - templates/index.html
        <!DOCTYPE html>
        <html>
        <head>
            <title>Home Page</title>
        </head>
        <body>
            <h1>Hello, {{ name }}!</h1>
            <p>Welcome to your Flask app.</p>
        </body>
        </html>

c. Use render_template() in "app.py":
Modify your Python application to import and use the 'render_template' function, passing variables as keyword arguments.
    - app.py
        from flask import Flask, render_template

        app = Flask(__name__)

        @app.route('/')
        def index():
            # Pass an html 'file.html' to the template
            return render_template('index.html')

        if __name__ == '__main__':
            app.run(debug=True)

Step 6: Ping service
--------------------------------------------------------
a. Checking devices availability using the built-in "subprocess" module.
The "subprocess" module is a powerful built-in option that allows you to run external system commands and capture their output. This approach requires handling the differences in ping commands between operating systems (e.g., -n for Windows, -c for Linux/macOS). 

    import subprocess
    import platform

    def ping_ip(ip_address):
        """
        Pings an IP address and returns True if reachable, False otherwise.
        """
        # Determine the correct command line argument for count
        param = '-n' if platform.system().lower() == 'windows' else '-c'
        command = ['ping', param, '1', ip_address] # Ping 1 time

        try:
            # Run the command, capture output, and check the return code
            result = subprocess.run(command, capture_output=True, text=True, timeout=5)
            # Exit code 0 means success
            if result.returncode == 0:
                return True
            else:
                return False
        except subprocess.TimeoutExpired:
            print(f"Ping to {ip_address} timed out.")
            return False
        except Exception as e:
            print(f"An error occurred: {e}")
            return False

    # Example usage:
    target = '127.0.0.1'
    if ping_ip(target):
        print(f"{target} is CONNECTED")
    else:
        print(f"{target} is NOT CONNECTED")

b. How it works: "subprocess.check_output()" runs the system's ping command. 
    If the ping is successful (exit code 0), it returns the output. 
    If it fails (non-zero exit code), it raises a CalledProcessError, which is caught to indicate the host is down.
    Cross-platform note: The number of pings is specified with -n on Windows and -c on Linux/macOS, so the script checks the operating system first. 

Step 7: Cal the service from the main "app.py"
--------------------------------------------------------
a. To call a Python function from a different file, you must import the file (which acts as a module) into your current script. 
Both files must be in the same directory for the import to work correctly. 

b. Assume you have two files in the same directory: my_functions.py (containing the function definition) and main_script.py (where you want to call the function). 
    1. Define the Function (my_functions.py):

        directory/my_functions.py

        def greet(name):
            """A function that greets the given name."""
            return f"Hello, {name}!"

        def add_numbers(a, b):
            """A function that adds two numbers."""
            return a + b
    
    2. Call the Function in Another File (main_script.py):
        There are several ways to import and use the function in main_script.py: 
            I. Import the entire module: This is good for organizing code and avoiding naming conflicts.

                directory/main_script.py
                import my_functions

                message = my_functions.greet("Bob")
                print(message)

                result = my_functions.add_numbers(5, 3)
                print(result)

            II. Import specific functions: This allows you to use the function name directly without the . (dot) notation.

                directory/main_script.py
                from my_functions import greet, add_numbers

                message = greet("Alice")
                print(message)

                result = add_numbers(10, 20)
                print(result)

________

ask for:
make the heatmap itself take 2/3 of the pannel while the names take 1/3 of the pannel.
make notification show in all pages (like switch-monitor).
make the notification be in colors.  