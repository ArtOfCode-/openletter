echo "> tsc -t es5 --lib es7 --outDir build ./*.ts" &&
tsc -t es5 --lib es7 --outDir build ./*.ts &&
echo "> uglifyjs public/javascripts/*.js -c --source-map -o build/public/javascripts/application.js" &&
uglifyjs public/javascripts/*.js -c --source-map -o build/public/javascripts/application.js &&
echo "> cp -r public/stylesheets build/public" &&
cp -r public/stylesheets build/public &&
echo "> cp -r views build" &&
cp -r views build