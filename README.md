How to Run the Application

Prerequisites

Before running the application, make sure the following are installed:
	•	Node.js (version 18 or newer recommended)
	•	npm (included with Node.js)
	•	Python 3
	•	yt-dlp installed and available in your system PATH

Install yt-dlp using:

pip install -U yt-dlp

Verify installations:

node -v
npm -v
python3 –version
yt-dlp –version

⸻

Project Structure

url_to_mp4_converter/
index.html     GUI layout
main.js        Electron main process
preload.js     Secure IPC bridge
renderer.js    Frontend logic
package.json   App configuration

⸻

Installation
	1.	Clone the repository:

git clone https://github.com/ParanoidAndroid404/URL-to-MP4-Extractor.git
cd URL-to-MP4-Extractor
	2.	Install dependencies:

npm install

⸻

Running the Application

Start the Electron app with:

npm start

The desktop GUI will launch.

⸻

Usage Instructions
	1.	Paste a video page URL into the input field.
	2.	Choose a save location.
	3.	Optional settings:
	•	Enable “Convert to MP4” if re-encoding is needed
	•	Enable “Use browser cookies” for supported sites
	4.	Click “List Formats” to check available streams.
	5.	Click “Download MP4”.

⸻

Attribution & Commercial Use

This project was originally developed by Will Woods.

Open-source contributions and improvements are welcome under the GPL-3.0 license.

If you intend to:
	•	deploy this project as a hosted website,
	•	monetize it,
	•	or integrate it into a revenue-generating product,

you must involve the original author.

Contact

GitHub: https://github.com/ParanoidAndroid404
Email: paranoid_android404.dev@proton.me