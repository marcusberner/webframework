var path = require('path'),
	fs = require('fs');

module.exports = function (app, options, lessCompiler, widgets, siteSandal) {

	return function (callback) {

		var virtualStyleFolder = '/style';

		app.get(path.join(virtualStyleFolder, '*'), function (req, res, next) {
			getFilePathAndType(req.path, function (pathAndType) {
				if (!pathAndType) return next();
				getLess(siteSandal, req, pathAndType, function (err, less) {
					if (err) return next(err);
					less = less || '';
					if (req.query.includeWidgets === 'true') {
						widgets.forEach(function(widget) {
							if (!widget.less) return;
							if (widget.wrap) less += ('.' + widget.cssClass + '{');
							less += (' @import \''+ path.relative(path.dirname(pathAndType.path), widget.less) + '\'; ');
							if (widget.wrap) less += '}';
						});
					}
					if (req.query.includeWidgetTheme) {
						widgets.forEach(function(widget) {
							if (!widget.themes[req.query.includeWidgetTheme]) return;
							if (widget.wrap) less += ('.' + widget.cssClass + '{');
							less += (' @import \''+ path.relative(path.dirname(pathAndType.path), widget.themes[req.query.includeWidgetTheme].less) + '\'; ');
							if (widget.wrap) less += '}';
						});
					}
					lessCompiler(pathAndType.path, less, function (err, css) {
						if (err) return next(err);
						if (!css) return next();
						sendCss(res, css);
					});
				});
			});
		});

		callback();

	};

};

function getLess (siteSandal, req, pathAndType, callback) {
	if (pathAndType.type === 'less') {
		fs.readFile(pathAndType.path, { encoding: 'utf8' }, callback);
	} else {
		siteSandal.resolveAsFactory(require(pathAndType.path), function (err, getData) {
			getData(req, callback);
		});
	}
}

function getFilePathAndType (reqPath, callback) {
	var pattern = /(.*)\.css$/i,
		match = pattern.exec(reqPath);
	if (!match) return callback();
	var lessFilePath = path.join(process.cwd(), match[1] + '.less'),
		jsFilePath = path.join(process.cwd(), match[1] + '.js');
	fs.exists(lessFilePath, function (exists) {
		if (exists) return callback({ path: lessFilePath, type: 'less' });
		fs.exists(jsFilePath, function (exists) {
			if (exists) return callback({ path: jsFilePath, type: 'js' });
			callback();
		});
	});
}

function sendCss (res, css) {
	var etag = '"' + require('crypto').createHash('md5').update(css).digest('hex') + '"';
	res.set({
		'Content-Type': 'text/css',
		'ETag': etag,
		'Cache-Control': 'max-age=31536000'
	});
	res.send(css);
}