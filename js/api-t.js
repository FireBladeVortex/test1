const api = document.createElement('script')
	api.src = "https://www.youtube.com/iframe_api"
	document.head.appendChild(api)

let player = null

function onYouTubeIframeAPIReady() {
	player = new YT.Player('you_player', {
		width: '100%',
		height: '100%',
		videoId: '',
		playerVars: {
			autoplay: 0,
			rel: 0,
			fs: 0,
			disablekb: 1,
			controls: 0,
		},
		events: {
			onReady: () => {
				player.setVolume(+document.getElementById('volume-bar').value)
			},
			onStateChange: onPlayerStateChange
		}
	})
}

const id_find = id => {
	try {
		const url = new URL(id)
		return url.searchParams.get('v') ?? url.pathname.split('/').pop()
	} catch {
		return id
	}
}

const time_convert = time => {
	if (typeof time === 'number') return time
	if (typeof time === 'string') {
		const sec = time.replace(/[^0-9:]/g, '')
		return sec.includes(':') ? sec.split(':').reduce((acc, cur) => acc * 60 + +cur, 0) : +sec
	}
	return 0
}

const time_find = id => {
	try {
		const time = new URL(id).searchParams.get('t')
		return time !== null ? time_convert(time) : 0
	} catch {
		return 0
	}
}

let video_click = -1
let video_play = null
let play_bar_ctrl = null
let start_sec = 0
let end_sec = 0
let last_sec = 0

const overlay = document.querySelectorAll('#right, #ad')

function overlay_click() {
	if (video_click === -1) return
	if (player.getPlayerState() === YT.PlayerState.PLAYING) {
		player.pauseVideo()
	} else if (player.getPlayerState() === YT.PlayerState.PAUSED) {
		player.playVideo()
	}
}

function total_list() {
	const list = document.getElementById('list')
	for (let index = 0; index < video_list.length; index++) {
		const ready = video_list[index]
		const btn = document.createElement('button')
		btn.className = 'btn'
		btn.dataset.index = index

		const img = document.createElement('img')
		img.src = `https://img.youtube.com/vi/${id_find(ready.id)}/mqdefault.jpg`
		btn.appendChild(img)
		list.appendChild(btn)

		btn.addEventListener('click', () => {
			if (video_click === index && player.getPlayerState() === YT.PlayerState.PLAYING) {
				player.pauseVideo()
			} else if (video_click === index && player.getPlayerState() === YT.PlayerState.PAUSED) {
				player.playVideo()
			} else {
				loop(index)
			}
		})
	}
}

function loop(index) {
	if (!player || !video_list[index]) return

	// #3 초기화
	clearInterval(play_bar_ctrl) // 추가
	play_bar_ctrl = null // 추가
	last_sec = 0 // 추가
	overlay.forEach(o => { o.onclick = null }) // 추가
	document.getElementById('play-now').style.width = '0%' // 추가
	document.getElementById('play-msg').textContent = '재생 목록에서 선택하세요' // 추가

	// 썸네일 강조/흐리게 갱신 (추가)
	document.querySelectorAll('.btn').forEach(btn => {
		btn.classList.remove('active', 'blur')
		if (parseInt(btn.dataset.index) !== index) btn.classList.add('blur')
	})
	document.querySelector(`.btn[data-index="${index}"]`).classList.add('active') // 추가

	// 커서 변경 (최초 1번 → 매번 유지)
	overlay.forEach(o => { o.style.cursor = 'pointer' }) // 수정

	video_click = index // 수정
	video_play = video_list[index]

	const time_sec = time_find(video_play.id)
	end_sec = time_convert(video_play.end)

	if (time_sec === 0) {
		start_sec = time_convert(video_play.start)
	} else if (end_sec > 0 && end_sec <= time_sec) {
		start_sec = 0
	} else {
		start_sec = time_sec
	}

	player.cueVideoById({
		videoId: id_find(video_play.id),
		startSeconds: start_sec,
		...(end_sec > 0 && { endSeconds: end_sec })
	})
}
/*
function onPlayerStateChange(event) {
	// #2 진입: 재생 시작 최초 1번
	if (event.data === YT.PlayerState.PLAYING && video_play) {
		if (last_sec === 0) {
			player.setPlaybackRate(1)
			last_sec = end_sec > 0 ? end_sec : player.getDuration()
			update(player.getCurrentTime())
			overlay.forEach(o => { o.onclick = overlay_click })
		}

		clearInterval(play_bar_ctrl)
		play_bar_ctrl = setInterval(() => {
			if (!player || !video_play) return
			const cur = player.getCurrentTime()
			if (end_sec > 0 && cur >= end_sec) {
				player.seekTo(start_sec, true)
			}
			const ratio = (cur - start_sec) / (last_sec - start_sec)
			document.getElementById('play-now').style.width = Math.max(0, Math.min(1, ratio)) * 100 + '%'
			update(cur)
		}, 100)
	}

	if (event.data === YT.PlayerState.ENDED && video_play) {
		player.seekTo(start_sec, true)
		player.playVideo()
	}

	if (event.data === YT.PlayerState.PAUSED) {
		clearInterval(play_bar_ctrl)
	}

	document.getElementById('ad').classList.toggle('skip', event.data !== 1 && event.data !== 2)
}
	*/
function onPlayerStateChange(event) {
	document.getElementById('ad').classList.toggle('skip', event.data !== 1 && event.data !== 2) // 수정 (맨 위로 이동)

	if (event.data === YT.PlayerState.PLAYING && video_play) {
		if (last_sec === 0 && document.getElementById('ad').classList.contains('skip')) { // 수정
			player.setPlaybackRate(1)
			last_sec = end_sec > 0 ? end_sec : player.getDuration()
			update(player.getCurrentTime())
			overlay.forEach(o => { o.onclick = overlay_click })
		}

		clearInterval(play_bar_ctrl)
		play_bar_ctrl = setInterval(() => {
			if (!player || !video_play) return
			const cur = player.getCurrentTime()
			if (end_sec > 0 && cur >= end_sec) {
				player.seekTo(start_sec, true)
			}
			const ratio = (cur - start_sec) / (last_sec - start_sec)
			document.getElementById('play-now').style.width = Math.max(0, Math.min(1, ratio)) * 100 + '%'
			update(cur)
		}, 100)
	}

	if (event.data === YT.PlayerState.ENDED && video_play) {
		player.seekTo(start_sec, true)
		player.playVideo()
	}

	if (event.data === YT.PlayerState.PAUSED) {
		clearInterval(play_bar_ctrl)
	}
}
function update(time = 0) {
	const fmt = sec => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`
	const cur = fmt(time)
	const end = end_sec > 0 ? fmt(end_sec) : fmt(player.getDuration())
	if (start_sec === 0) {
		document.getElementById('play-msg').textContent = `${cur} → ${end}`
	} else {
		document.getElementById('play-msg').textContent = `${fmt(start_sec)} → ${cur} → ${end}`
	}
}

document.getElementById('volume-bar').addEventListener('input', Volume => {
	if (player) player.setVolume(+Volume.target.value)
})

document.getElementById('volume').addEventListener('mousedown', drag => drag.stopPropagation())
document.getElementById('volume').addEventListener('click', click => click.stopPropagation())

let vol_vertical = false
document.addEventListener('keydown', v => {
	if (v.key === 'v' || v.key === 'V') {
		vol_vertical = !vol_vertical
		document.getElementById('volume-bar').classList.toggle('vertical', vol_vertical)
	}
})

document.addEventListener('keydown', key => {
	if (!player || (player.getPlayerState() !== 1 && player.getPlayerState() !== 2)) return
	if (key.code === 'Space') {
		key.preventDefault()
		overlay_click()
	} else if (key.code === 'Numpad1') {
		key.preventDefault()
		player.setPlaybackRate(Math.max(0.25, +((player.getPlaybackRate() * 100 - 5) / 100).toFixed(2)))
	} else if (key.code === 'Numpad2') {
		key.preventDefault()
		player.setPlaybackRate(Math.min(2, +((player.getPlaybackRate() * 100 + 5) / 100).toFixed(2)))
	} else if (key.code === 'Numpad3') {
		key.preventDefault()
		player.setPlaybackRate(1)
	} else if (key.code === 'NumpadAdd') {
		key.preventDefault()
		const volume = player.getVolume()
		const up = volume % 5 === 0 ? volume + 5 : Math.ceil(volume / 5) * 5
		player.setVolume(Math.min(100, up))
		document.getElementById('volume-bar').value = Math.min(100, up)
	} else if (key.code === 'NumpadSubtract') {
		key.preventDefault()
		const volume = player.getVolume()
		const down = volume % 5 === 0 ? volume - 5 : Math.floor(volume / 5) * 5
		player.setVolume(Math.max(0, down))
		document.getElementById('volume-bar').value = Math.max(0, down)
	}
})

document.addEventListener('wheel', wheel => {
	wheel.preventDefault()
	if (!player || (player.getPlayerState() !== 1 && player.getPlayerState() !== 2)) return
	const volume = player.getVolume()
	const delta = wheel.deltaY < 0 ? 5 : -5
	const next = Math.min(100, Math.max(0, volume + delta))
	player.setVolume(next)
	document.getElementById('volume-bar').value = next
})

total_list()
