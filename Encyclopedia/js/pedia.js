const book = document.getElementById('book')
const open_book = document.getElementById('open_book')

book.addEventListener('click', () =>
{
	open_book.classList.add('active')
})




setInterval(cursor_toggle, 300) // 추가

let is_grabbing = false // 추가
function cursor_toggle()
{
	is_grabbing = !is_grabbing // 추가
	book.classList.toggle('grabbing', is_grabbing) // 수정
}



document.querySelectorAll('[data-reset_target]').forEach((btn) => // 추가
{
	btn.addEventListener('click', () => // 추가
	{
		const target = document.querySelector(`[data-name="${btn.dataset.reset_target}"]`) // 추가
		if (target) target.value = '' // 추가
	})
})



open_book.addEventListener('click', (e) => // 추가
{
	const target = e.target.closest('.btn') // 추가
	if (!target) return // 추가

	const group = target.closest('.page_split_split:nth-child(even)') // 추가
	if (!group) return // 추가

	if (group.classList.contains('multi')) // 추가 (다중 선택 예외 그룹)
	{
		target.classList.toggle('on') // 추가
	}
	else // 추가 (기본 단일 선택)
	{
		const already_on = target.classList.contains('on') // 추가

		group.querySelectorAll('.btn.on').forEach((btn) => // 추가
		{
			btn.classList.remove('on') // 추가
		})

		if (!already_on) // 추가 (같은 버튼 다시 누르면 off로 토글)
		{
			target.classList.add('on') // 추가
		}
	}
})


const reset_all = document.querySelector('.reset_all') // 추가

reset_all.addEventListener('click', () => // 추가
{
	open_book.querySelectorAll('.btn.on').forEach((btn) => // 추가 (on 상태인 버튼만 off)
	{
		btn.classList.remove('on') // 추가
	})

	open_book.querySelectorAll('.input').forEach((input) => // 추가 (input 전체 초기화)
	{
		input.value = '' // 추가
	})
})