const book = document.getElementById('book')
const open_book = document.getElementById('open_book')

book.addEventListener('click', () =>
{
	open_book.classList.add('active')
})
