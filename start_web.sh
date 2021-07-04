# Put neardev account into the config.js file
account=$(cat ./neardev/dev-account)
fline="const CONTRACT_NAME = '$account'"
sed -i "1s/.*/$fline/" ./website/assets/js/config.js

# Start website
cd website
bundle exec jekyll serve --livereload -o