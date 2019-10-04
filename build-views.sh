sleep 1 &&
uglifyjs public/javascripts/*.js -c --source-map -o build/public/javascripts/application.js &&
cp -r views build &&
cp -r public/stylesheets build/public &&
cp -r public/images build/public