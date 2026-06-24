const book = document.getElementById('book')
const open_book = document.getElementById('open_book')

book.addEventListener('click', () =>
{
	open_book.classList.add('active')
})



let is_grabbing = false // 추가

setInterval(() =>
{
	is_grabbing = !is_grabbing // 추가

	book.classList.toggle('grabbing', is_grabbing) // 수정
}, 500) // 추가