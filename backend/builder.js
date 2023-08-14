const { minify } = require('html-minifier');
const fs = require('fs');
const UglifyJS = require("uglify-js");
const CleanCSS = require('clean-css');

let cleancss = new CleanCSS({});

let options = {
    collapseWhitespace: true,
    removeComments: true,
    collapseBooleanAttributes: true,
    useShortDoctype: true,
    removeEmptyAttributes: true,
    removeOptionalTags: true,
    minifyJS: true };

let uglifyjsoptions = {
    mangle: { reserved: ["$element","$timeout","$interval","$http"] },
  };



if(!fs.existsSync('dist')) fs.mkdirSync('dist');
if(!fs.existsSync('public')) fs.mkdirSync('public');


//DELETE ALL FROM DIST
fs.readdirSync('dist', (err, files) => {
    if (err) throw err;
  
    for (const file of files) {
        console.log("!!!!!!!! "+file+" !!!!!!!!!!!!!!!!!!!!!!!!!!!!! remove")
        //fs.unlink(path.join(directory, file), err => 
            // {   if (err) throw err;
            // });
    }
  });


checkfolder('public');


function checkfolder(folder)
    {
        if(fs.existsSync(folder))
            fs.readdir(folder, (err, files) => 
                {   files.forEach(file => 
                        {   
                            if(fs.lstatSync(folder+"/"+file).isDirectory())
                                {   if(!fs.existsSync(folder.replace('public','dist')+"/"+file))
                                        fs.mkdirSync(folder.replace('public','dist')+"/"+file);
                                    checkfolder(folder+"/"+file);
                                }
                            else if(file.endsWith('.js'))
                                {   //console.log("JS "+folder+"/"+file+"       "+(folder.replace('public','dist'))+"/"+file);
                                    const code = fs.readFileSync(folder+"/"+file, 'utf8');
                                    const converted = UglifyJS.minify(code,uglifyjsoptions).code;
                                    fs.writeFile((folder.replace('public','dist'))+"/"+file,converted,(err)=>{console.log("minified JS:"+folder+"/"+file);})
                                }
                            else if(file.endsWith('.html'))
                                {   //console.log("HTML "+folder+"/"+file+"       "+(folder.replace('public','dist'))+"/"+file);
                                    const code=fs.readFileSync(folder+"/"+file, 'utf8');
                                    const converted=minify(code,options);
                                    fs.writeFile((folder.replace('public','dist'))+"/"+file,converted,(err)=>{console.log("minified HTML :"+folder+"/"+file);})
                                }
                            else if(file.endsWith('.css'))
                                {   //console.log("CSS "+folder+"/"+file+"       "+(folder.replace('public','dist'))+"/"+file);
                                    const code = fs.readFileSync(folder+"/"+file, 'utf8');
                                    const converted = cleancss.minify(code).styles;
                                    fs.writeFile((folder.replace('public','dist'))+"/"+file,converted,(err)=>{console.log("minified JS:"+folder+"/"+file);})
                                }
                            else{   const code = fs.readFileSync(folder+"/"+file);
                                    fs.writeFile((folder.replace('public','dist'))+"/"+file,code,(err)=>{console.log("copyed:"+folder+"/"+file);})
                                }
                        });
                });

    }



// let input=
//     "app.component('confirm', "+
//     "{   template:   ' <div> </div>',"+
//     "    controller: function GreetUserController($interval)"+
//     "        {   $interval();},"+
//     "    bindings: {}"+
//     "});"
//   console.log(UglifyJS.minify(input,uglifyjsoptions))