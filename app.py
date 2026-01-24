from flask import Flask, render_template
from pingService import ping_ip

app = Flask(__name__)

# Example usage:
@app.route('/ping/localhost')
def ping_localhost():
    target = '127.0.0.1'
    if ping_ip(target):
        return '<h1>NIC is CONNECTED</h1>'
    else:
        return print('Error pinging to localhost')

@app.route('/')
def index():
    return render_template('index.html')

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0')
