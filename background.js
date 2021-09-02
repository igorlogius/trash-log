
const dlstore = {};
const tabstore = {};
const bookmarkstore = {};

async function saveToStorage(item) {
	console.log('saveToStorage', item);
	await idbKeyval.set(item.id, item);
}

// Log notifications

browser.notifications.onShown.addListener( async (itemId) => {
	const all = await browser.notifications.getAll();
	const notificationOption = all[itemId];
	const item = {'id': (new Date().getTime()) , 'title': 'notification shown' + notifications.title, 'message': notificationOption.message }
	saveToStorage(item);
});

browser.downloads.onChanged.addListener((delta) => {
	if (delta.state) { 
		if(delta.state.current === "complete" || delta.state.current === 'interrupted') {
			const item = {'id': (new Date().getTime()) , 'title': 'download ' + delta.state.current, 'message': dlstore[delta.id].url}
			delete dlstore[delta.id];
			saveToStorage(item);
		}
	}
});
browser.downloads.onCreated.addListener((item) => { dlstore[item.id] = item; });

// log closed/removed tabs

browser.tabs.onUpdated.addListener(
	(tabId, changeInfo, tabInfo) => {
	if(tabInfo.url && /^https?:/.test(tabInfo.url) ) {
		tabstore[tabId] = tabInfo.url;
		console.log(tabId, tabInfo.url);
	}
}, {properties: ["url"] });


browser.tabs.onRemoved.addListener( (tabId, removeInfo) => {
	if(tabstore[tabId]) {
		const item = {'id': (new Date().getTime()) , 'title': 'tabs closed', 'message': tabstore[tabId]}
		delete tabstore[tabId];
		saveToStorage(item);
	}
});

//
// log removed bookmarks
//
function recUpdateBookmarStore(node) {
	let urls = [];
	if(node.url) {
		bookmarkstore[node.id] = node.url;
		urls.push(node.url);
	}
	if(node.children) {
		for(const child of node.children){
			urls = urls.concat(recUpdateBookmarStore(child));
		}
		bookmarkstore[node.id] = urls.join(" "); // urls can not contain spaces, so we use that as a seperator
		//console.log('recUpdateBookmarStore ', node.title, /*node.id,*/ urls);
	}
	return urls;
}

browser.bookmarks.onRemoved.addListener( async (id,removeInfo) => {
	const item = {'id': (new Date().getTime()) , 'title': 'bookmarks removed', 'message': bookmarkstore[id] }
	saveToStorage(item);
});

async function updateBookmarkStore(){
	console.log('updateBookmarkStore');
	recUpdateBookmarStore((await browser.bookmarks.getTree())[0]);
}
browser.bookmarks.onCreated.addListener(function(id, bookmarkInfo){
	if(bookmarkInfo.url) {
		bookmarkstore[id] = bookmarkInfo.url;
	}
});
browser.bookmarks.onChanged.addListener((id, changeInfo) => {
	if(changeInfo.url){
		bookmarkstore[id] = changeInfo.url;
	}
});
browser.bookmarks.onMoved.addListener(function(id, moveInfo) {
	// do nothing if element was moved inside its parent
	if(moveInfo.parentId !== moveInfo.oldParentId){
		updateBookmarkStore();
	}
});

browser.runtime.onInstalled.addListener(updateBookmarkStore);
browser.runtime.onStartup.addListener(updateBookmarkStore);


setInterval(updateBookmarkStore, 15*60*1000);
