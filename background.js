
const dlstore = {};
const tabstore = {};
const bookmarkstore = {};
let idbKeyval = new TKVS('keyval-store','keyval');


async function saveOpen(urls) {
	console.log('saveOpen', urls);
	await browser.storage.local.set({'openurls': urls});
}

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
			if(dlstore[delta.id]) {
				const item = {'id': (new Date().getTime()) , 'title': 'download ' + delta.state.current, 'message': dlstore[delta.id].url}
				delete dlstore[delta.id];
				saveToStorage(item);
			}
		}
	}
});
browser.downloads.onCreated.addListener((item) => {
	if(item.url && /^https?:/.test(item.url)) {
		dlstore[item.id] = item;
	}
});

// log closed/removed tabs

browser.tabs.onUpdated.addListener(
	async (tabId, changeInfo, tabInfo) => {
	if(tabInfo.url && /^https?:/.test(tabInfo.url) ) {
		tabstore[tabId] = tabInfo.url;
		console.log(tabId, tabInfo.url);

		const open_urls = new Set((await browser.tabs.query({})).map( t => t.url ).filter( u => /^https?:/.test(u) ) );
		saveOpen(open_urls);
	}
}, {properties: ["url"] });


browser.tabs.onRemoved.addListener( async (tabId, removeInfo) => {
	if(tabstore[tabId]) {
		const item = {'id': (new Date().getTime()) , 'title': 'tab closed', 'message': tabstore[tabId]}
		delete tabstore[tabId];
		saveToStorage(item);
	}

	const open_urls = new Set((await browser.tabs.query({})).filter( t => t.id !== tabId).map( t => t.url ).filter( u => /^https?:/.test(u) ) );
	saveOpen(open_urls);
});

//
// log removed bookmarks
//
function recUpdateBookmarStore(node) {
	let urls = [];
	if(node.url && /^https?:/.test(node.url) ) {
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
	if(bookmarkstore[id]) {
		const item = {'id': (new Date().getTime()) , 'title': 'bookmarks removed', 'message': bookmarkstore[id] }
		delete bookmarkstore[id];
		saveToStorage(item);
	}
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

async function onStartup() {
	updateBookmarkStore();

	// write previously opened tabs to log
	let tmp = await browser.storage.local.get('openurls');
	if(tmp['openurls']){
		tmp = tmp['openurls'];
	}

	const item = {'id': (new Date().getTime()) , 'title': 'tabs closed', 'message': [...tmp].join(" ") }
	saveToStorage(item);

}

browser.runtime.onInstalled.addListener(updateBookmarkStore);
browser.runtime.onStartup.addListener(onStartup);

setInterval(updateBookmarkStore, 15*60*1000);
