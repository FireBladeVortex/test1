
/*

https://developers.google.com/youtube/iframe_api_reference?hl=ko

https://gist.github.com/Araxeus/fc574d0f31ba71d62215c0873a7b048e

http://developer.mozilla.org/

https://developer.mozilla.org/en-US/docs/Web/API/Document_Object_Model/Events

https://developer.mozilla.org/en-US/docs/Web/API/UI_Events/Keyboard_event_code_values

*/



// YouTube Player iframe API 불러오기
const api = document.createElement("script")
api.src = "https://www.youtube.com/iframe_api"
document.head.appendChild(api)



// iframe 들어갈 변수 준비
let player = null



// iframe 호출
function onYouTubeIframeAPIReady()
{
	player = new YT.Player("you_player",
	{
		width: "100%",
		height: "100%",
		videoId: "d8dqNFNrXPk",
		playerVars:
		{
			autoplay: 0, // 자동재생 방지
			rel: 0, // 영상 종료 때 추천 방지
			// fs: 0, // 풀 스크린 버튼 숨김
			// disablekb: 1, // 유튜브 자체 키보드 조작 기능 방지 방향키 숫자 0~9 등
			// controls: 0, // 유튜브 일부 ui 숨김
			origin: window.location.origin,
		},
		// 현재 상태 불러오기
		events:
		{
			onReady: () =>
			{
				player.setVolume(+volume_bar.value) // 현재 value 적용
			},
			onStateChange : onPlayerStateChange
		}
	})
}



/*
영상 상태 확인
YT.PlayerState.ENDED = 0
YT.PlayerState.PLAYING = 1
YT.PlayerState.PAUSED = 2
YT.PlayerState.BUFFERING = 3
YT.PlayerState.CUED = 5
*/
const play = () => player?.getPlayerState?.() === YT.PlayerState.PLAYING
const pause = () => player?.getPlayerState?.() === YT.PlayerState.PAUSED
const play_now = () => play() || pause() // !play_now === !play && !pause

// 최초 재생 시작하기 전 상태
let img_click = null
// 정보 관리
let set_id = null
let set_name = null
let set_title = null
// 시간 관리
let sec_start = null
let sec_end = null
// 시간 메세지
let msg_start = null
let msg_end = null
//



function make_list()
{
	const left = document.getElementById("left")
	const video_type = [
		{ name: "video", tag: "동영상", data: list_data.video ?? null },
		{ name: "short", tag: "쇼츠", data: list_data.short ?? null },
		{ name: "long", tag: "다시보기", data: list_data.long ?? null },
	]

	video_type.forEach(type =>
	{
		if (!type.data) return

		const section = document.createElement("div")
		section.className = "section"
		section.dataset.type = type.name
		left.appendChild(section)

		const h1 = document.createElement("h1")
		h1.textContent = type.tag + " 재생 목록"
		section.appendChild(h1)

		if (type.name === "long")
		{
			make_long()
			return
		}

		const list = document.createElement("div")
		list.className = `list ${type.name}`
		section.appendChild(list)


		for (let num = 0; num < type.data.length; num++)
		{
			const ready = type.data[num]
			const btn = document.createElement("button")
			btn.className = "btn"
			btn.dataset.num = num
			btn.dataset.type = type.name

			const img = document.createElement("img")
			img.src = `https://img.youtube.com/vi/${ready_data(ready.id)}/mqdefault.jpg`

			btn.appendChild(img)
			list.appendChild(btn)

			btn.addEventListener("click", () =>
			{
				const target = (type.name + "_" + (num + "").padStart(3, "0"))
				if (img_click === target)
				{
					if (play())
					{
						player.pauseVideo()
					}
					else if (pause())
					{
						player.playVideo()
					}
					else
						return
				}
				else
				{
					click_img(target)
					ready_data(ready.id, ready.start, ready.end)
				}
			})
		}
	})
}



function click_img(target)
{
	// 활성화 버튼 강조 나머지 버튼 어둡게
	document.querySelectorAll(".btn").forEach(btn =>
	{
		const compare = (btn.dataset.type + "_" + (btn.dataset.num + "").padStart(3, "0"))
		const click_img = compare === target
		btn.classList.toggle("active", click_img)
		btn.classList.toggle("blur", !click_img)
	})
	// total_list에서 클릭한 썸네일 또 클릭할때 쓰는 장치
	img_click = target
}



// youtube 정보 가져오기 cue 상태 되기전
function ready_data(id, start = 0, end = 0)
{
	// 주소에서 id 추출
	const url = new URL(id)
	const get_id = url.searchParams.get("v") ?? url.pathname.split("/").pop()
	if (arguments.length === 1) return get_id

	// 클릭 시 id 저장
	set_id = get_id
	// 주소에서 t값 추출 + 시작시간 비교후 결정
	const get_start = parseInt(url.searchParams.get("t"))
	const set_start = !Number.isNaN(get_start) ? get_start : start
	;[sec_start, msg_start] = data_split(set_start)

	// 종료 시간 결정(getDuration() 아님)
	;[sec_end, msg_end] = data_split(end)

	// 영상 불러오기
	player.cueVideoById(
	{
		videoId : get_id,
		startSeconds : 0, // 광고 때문에 sec_start 대신 임시로 0
		...(sec_end > 0 && {endSeconds : sec_end})
	})

}



// 시간값 시간표시 정리
function data_split(time) 
{
	if (typeof time === "number" && time > 0)
	{
		const date = new Date(time * 1000)
		const hh = date.getUTCHours()
		const mm = date.getUTCMinutes()
		const ss = date.getUTCSeconds()
		const sss = time
		const hms = hms_convert([hh, mm, ss])
		return [ sss, hms ]
	}
	else if (typeof time === "string")
	{
		const fix = time.replace(/;/g, ":")
		const fix_check = time.includes(":")
		if (fix_check)
		{
			const fix_hms = fix.split(":")
			const ss = +(fix_hms.pop())
			const mm = fix_hms.length ? +(fix_hms.pop()) : 0
			const hh = fix_hms.length ? +(fix_hms.pop()) : 0
			const sss = hh * 3600 + mm * 60 + ss
			const hms = hms_convert([hh, mm, ss])
			return [ sss, hms ]
		}
	}
	else
	{
		return [ 0, 0 ]
	}
}



// 시간 메세지 표기법 정리 24:00:00
function hms_convert(hhmmss)
{
	const hms_check = hhmmss.findIndex(num => num !== 0)
	const slice_ready = hms_check === -1 ? hhmmss.length - 1 : hms_check
	const slice_zero = hhmmss.slice(slice_ready)
	const ctrl_zero = slice_zero.map((num, idx) => idx === 0 ? (num + "") : (num + "").padStart(2,"0"))
	const hms = ctrl_zero.join(":")
	return hms
}



// 상태 변화 감지에서 사용할 재생 막대 변수
let play_bar = null

// 재생 막대
function ctrl_view()
{
	const cur = player.getCurrentTime()
	const ratio = (cur - sec_start) / (sec_end - sec_start)
	document.getElementById("play_now").style.width = Math.max(0, Math.min(1, ratio)) * 100 + "%"

	/*
	const [, msg_cur] = data_split(cur)
	if (msg_end && msg_start)
	{
		if (sec_start === 0)
		{
			document.getElementById("play_msg").textContent = `${msg_cur} < ${msg_end}`
		}
		else
		{
			document.getElementById("play_msg").textContent = `${msg_start} < ${msg_cur} > ${msg_end}`
		}
	}
	*/

}


// long 섹션 필터 드롭다운 생성 (수정/추가)
function make_long()
{
	if (!list_data.long) return // long 파일 없으면 작동 안함

	const valid_list = [] // (추가) lang, name, title, start, end 모두 가진 song만 모아둠
	list_data.long.forEach(video => // (추가)
	{
		;(video.song ?? []).forEach(song => // (추가)
		{
			if (song.lang && song.name && song.title && song.start && song.end) // (추가)
			{
				valid_list.push({ id: video.id, ...song }) // (추가) 재생에 필요한 id도 함께 저장
			}
		})
	})


	const section = document.querySelector('.section[data-type="long"]')
	if (!section) return

	// 1행 (3칸, 1:3:1)
	const row1 = document.createElement("div")
	row1.className = "long_row1"
	section.appendChild(row1)

	const lang_select = document.createElement("select")
	lang_select.className = "long_lang"
	row1.appendChild(lang_select)

	const name_select = document.createElement("select")
	name_select.className = "long_name"
	row1.appendChild(name_select)

	const empty_col = document.createElement("div")
	empty_col.className = "long_empty"
	row1.appendChild(empty_col)
		
	const ready_btn = document.createElement("button") // (추가)
	ready_btn.className = "long_ready" // (추가)
	ready_btn.textContent = "재생 준비" // (추가)
	ready_btn.style.display = "none" // (추가) 제목 선택 전엔 숨김
	empty_col.appendChild(ready_btn) // (추가)

	// 2행 (1칸, 100%)
	const row2 = document.createElement("div")
	row2.className = "long_row2"
	section.appendChild(row2)

	const title_select = document.createElement("select")
	title_select.className = "long_title"
	row2.appendChild(title_select)

	// option 생성 도우미
	function make_option(select, value, text, selected = false)
	{
		const option = document.createElement("option")
		option.value = value
		option.textContent = text
		if (selected)
			{
				option.selected = true

		option.disabled = true // (추가) 선택 불가 처리
		option.hidden = true // (추가) 목록 펼쳤을때 숨김 처리
			}
		select.appendChild(option)
	}

	make_option(lang_select, "", "언어", true)
	;["한국어", "외국어"].forEach(lang => make_option(lang_select, lang, lang))

	make_option(name_select, "", "부른 이", true)
	make_option(title_select, "", "제목", true)

	// lang 값에 맞는 name 목록 갱신
	function update_name()
	{
		const lang_value = lang_select.value
		const names = new Set()

		valid_list.forEach(video =>
		{
			;(video.song ?? []).forEach(song =>
			{
				if ((!lang_value || song.lang === lang_value) && song.name)
				{
					names.add(song.name)
				}
			})
		})

		name_select.innerHTML = ""
		make_option(name_select, "", "부른 이", true)
		;[...names].forEach(name => make_option(name_select, name, name))
	}

	// lang, name 값에 맞는 title 목록 갱신 (name 선택 시에만 등장)
	function update_title()
	{
		const lang_value = lang_select.value
		const name_value = name_select.value

		title_select.innerHTML = ""
		make_option(title_select, "", "제목", true)

		if (!name_value) return // name 기본값이면 목록 비움

		const titles = new Set()

		valid_list.forEach(video =>
		{
			;(video.song ?? []).forEach(song =>
			{
				const lang_match = !lang_value || song.lang === lang_value
				const name_match = song.name === name_value
				if (lang_match && name_match && song.title)
				{
					titles.add(song.title)
				}
			})
		})

		;[...titles].forEach(title => make_option(title_select, title, title))

		ready_btn.style.display = "none" // (추가) 목록 갱신 시 버튼 초기화
	}

	lang_select.addEventListener("change", () =>
	{
		update_name()
		update_title()
	})
	name_select.addEventListener("change", update_title)
	title_select.addEventListener("change", () => // (추가)
	{
		ready_btn.style.display = title_select.value ? "block" : "none" // (추가) 제목 선택 시에만 버튼 표시
	})

	ready_btn.addEventListener("click", () => // (추가)
	{
		const target = "long_ready" // (추가)
		if (img_click === target) // (추가)
		{
			if (play()) // (추가)
			{
				player.pauseVideo() // (추가)
			}
			else if (pause()) // (추가)
			{
				player.playVideo() // (추가)
			}
			else // (추가)
				return // (추가)
		}
		else // (추가)
		{
			click_img(target) // (추가)

			const lang_value = lang_select.value // (추가)
			const name_value = name_select.value // (추가)
			const title_value = title_select.value // (추가)
			const song = valid_list.find(s => // (수정) list_data.long 순회 대신 valid_list에서 바로 찾음
				(!lang_value || s.lang === lang_value) &&
				s.name === name_value &&
				s.title === title_value
			)

			if (song)
			{
				ready_data(song.id, song.start, song.end) // (수정) video.id 대신 song.id (valid_list에 이미 포함됨)
			}
		}
	})

	update_name()
}

// 이름 제목
async function fetch_oembed(id)
{
	const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`
	try
	{
		const input = await fetch(url)
		const data = await input.json()
		
		set_name = data.author_name
		set_title = data.title
		document.title = set_name

		if (arguments.length !== 1) return

		document.getElementById("play_msg").style.textAlign = "start"
		document.getElementById("play_msg").textContent = set_title
	}
	catch
	{
	}
}



// 볼륨 변수
const volume = document.getElementById("volume")
const volume_bar = document.getElementById("volume_bar")



// 볼륨 조절 막대 값 반영 시키기
volume_bar.addEventListener("input", () =>
{
	player.setVolume(+volume_bar.value)
})



// 소리 크기 조절 간섭 방지
const stopp = move => move.stopPropagation()
volume.addEventListener("mousedown", stopp)
volume.addEventListener("click", stopp)



// 해당하는 키 입력 기본 작동을 무시
// 스페이스 바가 play_or_pause()를 실행
// 숫자 패드 컨트롤 또는 쉬프트 +-로 재생 속도 조절 (보류)
// 숫자 패드 +-로 소리 크기 조절
document.addEventListener("keydown", key =>
{
	const add = key.code === "NumpadAdd" || key.code === "ArrowUp"
	const sub = key.code === "NumpadSubtract" || key.code === "ArrowDown"
	// const cs = key.ctrlKey || key.shiftKey
	/*
	if (!cs)
	{
	*/
		if (add)
		{
			key.preventDefault()
			volume_value(+5)
		}
		else if (sub)
		{
			key.preventDefault()
			volume_value(-5)
		}
	/*
	}
	else if (cs && add || sub)
	{
		key.preventDefault()
	}
	*/
	// 준비안됐으면 작동 중지
	if (!player || !play_now()) return
	
	if (!key.repeat)
	{
		if (key.code === "Space")
		{
			key.preventDefault()
			play_or_pause()
		}
		if (key.code === "ArrowLeft")
		{
			key.preventDefault()
			player.seekTo(Math.max(sec_start, player.getCurrentTime() - 5), true) // sec_start 보다 작아질 수 없음
		}
		if (key.code === "ArrowRight")
		{
			key.preventDefault()
			player.seekTo(Math.min(sec_end, player.getCurrentTime() + 5), true) // sec_end 보다 커질 수 없음
		}
		// 현재 재생 위치 변경
		if (key.code.match(/^(Digit|Numpad)[0-9]$/))
		{
			key.preventDefault()
			const ratio = +(key.code.slice(-1)) / 10
			const numkey = sec_start + Math.floor((sec_end - sec_start) * ratio)
			player.seekTo(numkey, true)
		}

		/*
		else if (cs && add || sub)
		{
			key.preventDefault()
			const updown = add ? 0.05 : -0.05
			const limit = add ? 2 : 0.25
			const minmax  = add ? Math.min : Math.max
			player.setPlaybackRate(minmax(limit, (player.getPlaybackRate() + updown)))
		}
		else if (key.code === "Numpad0")
		{
			key.preventDefault()
			player.setPlaybackRate(1)
		}
		*/

	}
})



// 마우스 휠 소리 크기 조절 및 오작동 억제
document.addEventListener("wheel", wheel =>
{
	wheel.preventDefault()
	volume_value(wheel.deltaY < 0 ? +5 : -5)
},
{
	passive: false
})



// 소리 크기 조절
function volume_value(plma)
{
	const volume = player.getVolume()
	const updown = plma > 0
		? Math.floor(volume / 5) * 5 + 5
		: Math.ceil(volume / 5) * 5 - 5
	const change = Math.min(100, Math.max(0, updown))
	player.setVolume(change)
	volume_bar.value = change
}



// 재생 속도 조절
function play_speed(key, plma)
{
}



// 재생 일시중지
function play_or_pause()
{
	if (play())
	{
		player.pauseVideo()
	}
	else if (pause())
	{
		player.playVideo()
	}
}



/*
영상 상태 확인
YT.PlayerState.ENDED = 0
YT.PlayerState.PLAYING = 1
YT.PlayerState.PAUSED = 2
YT.PlayerState.BUFFERING = 3
YT.PlayerState.CUED = 5
*/
// 동영상 상태가 변화하면 즉시 작동
function onPlayerStateChange(event)
{
	// 영상 정보 불러온 상태(재생 시작 전)
	if (event.data === 5)
	{
		player.setPlaybackRate(1)
		if (sec_end === 0)
		{
			[sec_end, msg_end] = data_split(player.getDuration())
		}
		let title = null
		try
		{
			title = player.getVideoData().title
		}
		catch
		{
		}
		if (title)
		{
			document.getElementById("play_msg").style.textAlign = "start"
			document.getElementById("play_msg").textContent = title
			fetch_oembed(set_id, title)
		}
		else
		{
			fetch_oembed(set_id)
		}
	}
	// 재생 중일 때 100ms마다 진행바 갱신
	if (event.data === 1)
	{
		if (player.getCurrentTime() < sec_start)
		{
			player.seekTo(sec_start, true)
		}
		clearInterval(play_bar) // 인터벌 중복 호출 방지
		play_bar = setInterval(ctrl_view, 100)
	}
	else
	{
		clearInterval(play_bar)
	}
	// 영상 재시작
	if (event.data === 0)
	{
		player.seekTo(sec_start, true)
		player.playVideo()
	}
	//
	const pop = [1, 2, 3].includes(event.data)
	document.querySelectorAll("#right").forEach(overlay => // ("#right, #ad")  // #ad 임시 삭제 사용자 선택으로 버튼 만들기 전까지
	{
		overlay.style.cursor = pop ? "pointer" : "default"
		overlay.onclick = pop ? play_or_pause : null
	})
	document.getElementById("ad").style.pointerEvents = pop ? "auto" : "none"
}

// 싲가
make_list()