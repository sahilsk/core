/*
 * Copyright (c) 2014
 *
 * This file is licensed under the Affero General Public License version 3
 * or later.
 *
 * See the COPYING-README file.
 *
 */

/* global OC, t, n, FileList, FileActions */
/* global getURLParameter, isPublic */
var Files = {
	// file space size sync
	_updateStorageStatistics: function() {
		Files._updateStorageStatisticsTimeout = null;
		var currentDir = FileList.getCurrentDirectory(),
			state = Files.updateStorageStatistics;
		if (state.dir){
			if (state.dir === currentDir) {
				return;
			}
			// cancel previous call, as it was for another dir
			state.call.abort();
		}
		state.dir = currentDir;
		state.call = $.getJSON(OC.filePath('files','ajax','getstoragestats.php') + '?dir=' + encodeURIComponent(currentDir),function(response) {
			state.dir = null;
			state.call = null;
			Files.updateMaxUploadFilesize(response);
		});
	},
	updateStorageStatistics: function(force) {
		if (!OC.currentUser) {
			return;
		}

		// debounce to prevent calling too often
		if (Files._updateStorageStatisticsTimeout) {
			clearTimeout(Files._updateStorageStatisticsTimeout);
		}
		if (force) {
			Files._updateStorageStatistics();
		}
		else {
			Files._updateStorageStatisticsTimeout = setTimeout(Files._updateStorageStatistics, 250);
		}
	},

	updateMaxUploadFilesize:function(response) {
		if (response === undefined) {
			return;
		}
		if (response.data !== undefined && response.data.uploadMaxFilesize !== undefined) {
			$('#max_upload').val(response.data.uploadMaxFilesize);
			$('#free_space').val(response.data.freeSpace);
			$('#upload.button').attr('original-title', response.data.maxHumanFilesize);
			$('#usedSpacePercent').val(response.data.usedSpacePercent);
			Files.displayStorageWarnings();
		}
		if (response[0] === undefined) {
			return;
		}
		if (response[0].uploadMaxFilesize !== undefined) {
			$('#max_upload').val(response[0].uploadMaxFilesize);
			$('#upload.button').attr('original-title', response[0].maxHumanFilesize);
			$('#usedSpacePercent').val(response[0].usedSpacePercent);
			Files.displayStorageWarnings();
		}

	},

	/**
	 * Fix path name by removing double slash at the beginning, if any
	 */
	fixPath: function(fileName) {
		if (fileName.substr(0, 2) == '//') {
			return fileName.substr(1);
		}
		return fileName;
	},

	/**
	 * Checks whether the given file name is valid.
	 * @param name file name to check
	 * @return true if the file name is valid.
	 * Throws a string exception with an error message if
	 * the file name is not valid
	 */
	isFileNameValid: function (name) {
		var trimmedName = name.trim();
		if (trimmedName === '.' || trimmedName === '..') {
			throw t('files', '"{name}" is an invalid file name.', {name: name});
		} else if (trimmedName.length === 0) {
			throw t('files', 'File name cannot be empty.');
		}
		// check for invalid characters
		var invalid_characters =
			['\\', '/', '<', '>', ':', '"', '|', '?', '*', '\n'];
		for (var i = 0; i < invalid_characters.length; i++) {
			if (trimmedName.indexOf(invalid_characters[i]) !== -1) {
				throw t('files', "Invalid name, '\\', '/', '<', '>', ':', '\"', '|', '?' and '*' are not allowed.");
			}
		}
		return true;
	},
	displayStorageWarnings: function() {
		if (!OC.Notification.isHidden()) {
			return;
		}

		var usedSpacePercent = $('#usedSpacePercent').val();
		if (usedSpacePercent > 98) {
			OC.Notification.show(t('files', 'Your storage is full, files can not be updated or synced anymore!'));
			return;
		}
		if (usedSpacePercent > 90) {
			OC.Notification.show(t('files', 'Your storage is almost full ({usedSpacePercent}%)', {usedSpacePercent: usedSpacePercent}));
		}
	},

	displayEncryptionWarning: function() {

		if (!OC.Notification.isHidden()) {
			return;
		}

		var encryptedFiles = $('#encryptedFiles').val();
		var initStatus = $('#encryptionInitStatus').val();
		if (initStatus === '0') { // enc not initialized, but should be
			OC.Notification.show(t('files_encryption', 'Encryption App is enabled but your keys are not initialized, please log-out and log-in again'));
			return;
		}
		if (initStatus === '1') { // encryption tried to init but failed
			OC.Notification.showHtml(t('files_encryption', 'Invalid private key for Encryption App. Please update your private key password in your personal settings to recover access to your encrypted files.'));
			return;
		}
		if (encryptedFiles === '1') {
			OC.Notification.show(t('files_encryption', 'Encryption was disabled but your files are still encrypted. Please go to your personal settings to decrypt your files.'));
			return;
		}
	},

	setupDragAndDrop: function() {
		var $fileList = $('#fileList');

		//drag/drop of files
		$fileList.find('tr td.filename').each(function(i,e) {
			if ($(e).parent().data('permissions') & OC.PERMISSION_DELETE) {
				$(e).draggable(dragOptions);
			}
		});

		$fileList.find('tr[data-type="dir"] td.filename').each(function(i,e) {
			if ($(e).parent().data('permissions') & OC.PERMISSION_CREATE) {
				$(e).droppable(folderDropOptions);
			}
		});
	},

	/**
	 * Returns the download URL of the given file
	 * @param filename file name of the file
	 * @param dir optional directory in which the file name is, defaults to the current directory
	 */
	getDownloadUrl: function(filename, dir) {
		var params = {
			dir: dir || FileList.getCurrentDirectory(),
			files: filename
		};
		return this.getAjaxUrl('download', params);
	},

	/**
	 * Returns the ajax URL for a given action
	 * @param action action string
	 * @param params optional params map
	 */
	getAjaxUrl: function(action, params) {
		var q = '';
		if (params) {
			q = '?' + OC.buildQueryString(params);
		}
		return OC.filePath('files', 'ajax', action + '.php') + q;
	}
};
$(document).ready(function() {
	// FIXME: workaround for trashbin app
	if (window.trashBinApp) {
		return;
	}
	Files.displayEncryptionWarning();
	Files.bindKeyboardShortcuts(document, jQuery);

	Files.setupDragAndDrop();

	$('#file_action_panel').attr('activeAction', false);

	// Triggers invisible file input
	$('#upload a').on('click', function() {
		$(this).parent().children('#file_upload_start').trigger('click');
		return false;
	});

	// Trigger cancelling of file upload
	$('#uploadprogresswrapper .stop').on('click', function() {
		OC.Upload.cancelUploads();
		FileList.updateSelectionSummary();
	});

	// Show trash bin
	$('#trash').on('click', function() {
		window.location=OC.filePath('files_trashbin', '', 'index.php');
	});

	// drag&drop support using jquery.fileupload
	// TODO use OC.dialogs
	$(document).bind('drop dragover', function (e) {
			e.preventDefault(); // prevent browser from doing anything, if file isn't dropped in dropZone
	});

	//do a background scan if needed
	scanFiles();

	// display storage warnings
	setTimeout(Files.displayStorageWarnings, 100);
	OC.Notification.setDefault(Files.displayStorageWarnings);

	// only possible at the moment if user is logged in
	if (OC.currentUser) {
		// start on load - we ask the server every 5 minutes
		var updateStorageStatisticsInterval = 5*60*1000;
		var updateStorageStatisticsIntervalId = setInterval(Files.updateStorageStatistics, updateStorageStatisticsInterval);

		// Use jquery-visibility to de-/re-activate file stats sync
		if ($.support.pageVisibility) {
			$(document).on({
				'show.visibility': function() {
					if (!updateStorageStatisticsIntervalId) {
						updateStorageStatisticsIntervalId = setInterval(Files.updateStorageStatistics, updateStorageStatisticsInterval);
					}
				},
				'hide.visibility': function() {
					clearInterval(updateStorageStatisticsIntervalId);
					updateStorageStatisticsIntervalId = 0;
				}
			});
		}
	}

	//scroll to and highlight preselected file
	if (getURLParameter('scrollto')) {
		FileList.scrollTo(getURLParameter('scrollto'));
	}
});

function scanFiles(force, dir, users) {
	if (!OC.currentUser) {
		return;
	}

	if (!dir) {
		dir = '';
	}
	force = !!force; //cast to bool
	scanFiles.scanning = true;
	var scannerEventSource;
	if (users) {
		var usersString;
		if (users === 'all') {
			usersString = users;
		} else {
			usersString = JSON.stringify(users);
		}
		scannerEventSource = new OC.EventSource(OC.filePath('files','ajax','scan.php'),{force: force,dir: dir, users: usersString});
	} else {
		scannerEventSource = new OC.EventSource(OC.filePath('files','ajax','scan.php'),{force: force,dir: dir});
	}
	scanFiles.cancel = scannerEventSource.close.bind(scannerEventSource);
	scannerEventSource.listen('count',function(count) {
		console.log(count + ' files scanned');
	});
	scannerEventSource.listen('folder',function(path) {
		console.log('now scanning ' + path);
	});
	scannerEventSource.listen('done',function(count) {
		scanFiles.scanning=false;
		console.log('done after ' + count + ' files');
		Files.updateStorageStatistics();
	});
	scannerEventSource.listen('user',function(user) {
		console.log('scanning files for ' + user);
	});
}
scanFiles.scanning=false;

function boolOperationFinished(data, callback) {
	result = jQuery.parseJSON(data.responseText);
	Files.updateMaxUploadFilesize(result);
	if (result.status === 'success') {
		callback.call();
	} else {
		alert(result.data.message);
	}
}

var createDragShadow = function(event) {
	//select dragged file
	var isDragSelected = $(event.target).parents('tr').find('td input:first').prop('checked');
	if (!isDragSelected) {
		//select dragged file
		$(event.target).parents('tr').find('td input:first').prop('checked',true);
	}

	var selectedFiles = FileList.getSelectedFiles();

	if (!isDragSelected && selectedFiles.length === 1) {
		//revert the selection
		$(event.target).parents('tr').find('td input:first').prop('checked',false);
	}

	//also update class when we dragged more than one file
	if (selectedFiles.length > 1) {
		$(event.target).parents('tr').addClass('selected');
	}

	// build dragshadow
	var dragshadow = $('<table class="dragshadow"></table>');
	var tbody = $('<tbody></tbody>');
	dragshadow.append(tbody);

	var dir=$('#dir').val();

	$(selectedFiles).each(function(i,elem) {
		var newtr = $('<tr/>').attr('data-dir', dir).attr('data-filename', elem.name).attr('data-origin', elem.origin);
		newtr.append($('<td/>').addClass('filename').text(elem.name));
		newtr.append($('<td/>').addClass('size').text(humanFileSize(elem.size)));
		tbody.append(newtr);
		if (elem.type === 'dir') {
			newtr.find('td.filename').attr('style','background-image:url('+OC.imagePath('core', 'filetypes/folder.png')+')');
		} else {
			var path = getPathForPreview(elem.name);
			Files.lazyLoadPreview(path, elem.mime, function(previewpath) {
				newtr.find('td.filename').attr('style','background-image:url('+previewpath+')');
			}, null, null, elem.etag);
		}
	});

	return dragshadow;
};

//options for file drag/drop
//start&stop handlers needs some cleaning up
var dragOptions={
	revert: 'invalid', revertDuration: 300,
	opacity: 0.7, zIndex: 100, appendTo: 'body', cursorAt: { left: 24, top: 18 },
	helper: createDragShadow, cursor: 'move',
		start: function(event, ui){
			var $selectedFiles = $('td.filename input:checkbox:checked');
			if($selectedFiles.length > 1){
				$selectedFiles.parents('tr').fadeTo(250, 0.2);
			}
			else{
				$(this).fadeTo(250, 0.2);
			}
		},
		stop: function(event, ui) {
			var $selectedFiles = $('td.filename input:checkbox:checked');
			if($selectedFiles.length > 1){
				$selectedFiles.parents('tr').fadeTo(250, 1);
			}
			else{
				$(this).fadeTo(250, 1);
			}
			$('#fileList tr td.filename').addClass('ui-draggable');
		}
};
// sane browsers support using the distance option
if ( $('html.ie').length === 0) {
	dragOptions['distance'] = 20;
}

var folderDropOptions={
	hoverClass: "canDrop",
	drop: function( event, ui ) {
		//don't allow moving a file into a selected folder
		if ($(event.target).parents('tr').find('td input:first').prop('checked') === true) {
			return false;
		}

		var target = $(this).closest('tr').data('file');

		var files = ui.helper.find('tr');
		$(files).each(function(i,row) {
			var dir = $(row).data('dir');
			var file = $(row).data('filename');
							//slapdash selector, tracking down our original element that the clone budded off of.
				var origin = $('tr[data-id=' + $(row).data('origin') + ']');
				var td = origin.children('td.filename');
				var oldBackgroundImage = td.css('background-image');
				td.css('background-image', 'url('+ OC.imagePath('core', 'loading.gif') + ')');
			$.post(OC.filePath('files', 'ajax', 'move.php'), { dir: dir, file: file, target: dir+'/'+target }, function(result) {
				if (result) {
					if (result.status === 'success') {
						//recalculate folder size
						var oldFile = FileList.findFileEl(target);
						var newFile = FileList.findFileEl(file);
						var oldSize = oldFile.data('size');
						var newSize = oldSize + newFile.data('size');
						oldFile.data('size', newSize);
						oldFile.find('td.filesize').text(humanFileSize(newSize));

						FileList.remove(file);
						FileList.updateSelectionSummary();
						$('#notification').hide();
					} else {
						$('#notification').hide();
						$('#notification').text(result.data.message);
						$('#notification').fadeIn();
					}
				} else {
					OC.dialogs.alert(t('files', 'Error moving file'), t('files', 'Error'));
				}
				td.css('background-image', oldBackgroundImage);
			});
		});
	},
	tolerance: 'pointer'
};

Files.getMimeIcon = function(mime, ready) {
	if (Files.getMimeIcon.cache[mime]) {
		ready(Files.getMimeIcon.cache[mime]);
	} else {
		$.get( OC.filePath('files','ajax','mimeicon.php'), {mime: mime}, function(path) {
			Files.getMimeIcon.cache[mime]=path;
			ready(Files.getMimeIcon.cache[mime]);
		});
	}
}
Files.getMimeIcon.cache={};

function getPathForPreview(name) {
	var path = $('#dir').val() + '/' + name;
	return path;
}

/**
 * Generates a preview URL based on the URL space.
 * @param urlSpec map with {x: width, y: height, file: file path}
 * @return preview URL
 */
Files.generatePreviewUrl = function(urlSpec) {
	return OC.Router.generate('core_ajax_preview', urlSpec);
}

Files.lazyLoadPreview = function(path, mime, ready, width, height, etag) {
	// get mime icon url
	Files.getMimeIcon(mime, function(iconURL) {
		var urlSpec = {};
		var previewURL;
		ready(iconURL); // set mimeicon URL

		// now try getting a preview thumbnail URL
		if ( ! width ) {
			width = $('#filestable').data('preview-x');
		}
		if ( ! height ) {
			height = $('#filestable').data('preview-y');
		}
		// note: the order of arguments must match the one
		// from the server's template so that the browser
		// knows it's the same file for caching
		urlSpec.x = width;
		urlSpec.y = height;
		urlSpec.file = Files.fixPath(path);

		if (etag){
			// use etag as cache buster
			urlSpec.c = etag;
		}
		else {
			console.warn('Files.lazyLoadPreview(): missing etag argument');
		}

		previewURL = Files.generatePreviewUrl(urlSpec);
		previewURL = previewURL.replace('(', '%28');
		previewURL = previewURL.replace(')', '%29');

		// preload image to prevent delay
		// this will make the browser cache the image
		var img = new Image();
		img.onload = function(){
			//set preview thumbnail URL
			ready(previewURL);
		}
		img.src = previewURL;
	});
};

function getUniqueName(name) {
	if (FileList.findFileEl(name).exists()) {
		var numMatch;
		var parts=name.split('.');
		var extension = "";
		if (parts.length > 1) {
			extension=parts.pop();
		}
		var base=parts.join('.');
		numMatch=base.match(/\((\d+)\)/);
		var num=2;
		if (numMatch && numMatch.length>0) {
			num=parseInt(numMatch[numMatch.length-1])+1;
			base=base.split('(');
			base.pop();
			base=$.trim(base.join('('));
		}
		name=base+' ('+num+')';
		if (extension) {
			name = name+'.'+extension;
		}
		return getUniqueName(name);
	}
	return name;
}

function checkTrashStatus() {
	$.post(OC.filePath('files_trashbin', 'ajax', 'isEmpty.php'), function(result) {
		if (result.data.isEmpty === false) {
			$("input[type=button][id=trash]").removeAttr("disabled");
		}
	});
}

// override core's fileDownloadPath (legacy)
function fileDownloadPath(dir, file) {
	return Files.getDownloadUrl(file, dir);
}

