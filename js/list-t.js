/* ════════════════════════════════════════
	 영상 목록 저장
	 id : YouTube 영상 ID
	 start : 반복 시작 시간
	 end   : 반복 종료 시간
════════════════════════════════════════ */
const video_list = [
	{
		id: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
		start: 0,
		end: 0
	},
	{
		id: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
		start: 1,
		end: 0
	},
	{
		id: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
		start: 110,
		end: 0
	},
	{
		id: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
		start: '1:50',
		end: 0
	},
	{
		id: "https://youtu.be/dQw4w9WgXcQ?si=vxKMNftGkUcLYuLY",
		start: 0,
		end: 0
	},
	{
		id: "https://youtu.be/dQw4w9WgXcQ?si=vxKMNftGkUcLYuLY",
		start: 1,
		end: 0
	},
	{
		id: "https://youtu.be/dQw4w9WgXcQ?si=vxKMNftGkUcLYuLY",
		start: 110,
		end: 0
	},
	{
		id: "https://youtu.be/dQw4w9WgXcQ?si=vxKMNftGkUcLYuLY",
		start: '1:50',
		end: 0
	},
	{
		id: "https://www.youtube.com/watch?si=vxKMNftGkUcLYuLY&v=dQw4w9WgXcQ&feature=youtu.be",
		start: 0,
		end: 0
	},
	{
		id: "https://www.youtube.com/watch?si=vxKMNftGkUcLYuLY&v=dQw4w9WgXcQ&feature=youtu.be",
		start: 1,
		end: 0
	},
	{
		id: "https://www.youtube.com/watch?si=vxKMNftGkUcLYuLY&v=dQw4w9WgXcQ&feature=youtu.be",
		start: 110,
		end: 0
	},
	{
		id: "https://www.youtube.com/watch?si=vxKMNftGkUcLYuLY&v=dQw4w9WgXcQ&feature=youtu.be",
		start: 120,
		end: 0
	},
	{
		id: "https://www.youtube.com/watch?si=vxKMNftGkUcLYuLY&v=dQw4w9WgXcQ&feature=youtu.be",
		start: '1:50',
		end: 0
	},
	{
		id: "https://youtu.be/dQw4w9WgXcQ?si=GWWWz5An6c8SfI4q&t=110",
		start: 0,
		end: 0
	},
	{
		id: "https://youtu.be/dQw4w9WgXcQ?si=GWWWz5An6c8SfI4q&t=110",
		start: 1,
		end: 0
	},
	{
		id: "https://youtu.be/dQw4w9WgXcQ?si=GWWWz5An6c8SfI4q&t=110",
		start: 120,
		end: 0
	},
	{
		id: "https://youtu.be/dQw4w9WgXcQ?si=GWWWz5An6c8SfI4q&t=110",
		start: 100,
		end: 0
	},
	{
		id: "https://youtu.be/dQw4w9WgXcQ?si=GWWWz5An6c8SfI4q&t=110",
		start: 110,
		end: 0
	},
	{
		id: "https://youtu.be/dQw4w9WgXcQ?si=GWWWz5An6c8SfI4q&t=110",
		start: "1:50",
		end: 0
	},
	{
		id: "https://youtu.be/dQw4w9WgXcQ?si=GWWWz5An6c8SfI4q&t=110",
		start: '1:30',
		end: 0
	},
	{
		id: "https://youtu.be/dQw4w9WgXcQ?si=GWWWz5An6c8SfI4q&t=110",
		start: '2:20',
		end: 0
	},
	{
		id: "https://www.youtube.com/watch?si=GWWWz5An6c8SfI4q&t=120&v=dQw4w9WgXcQ&feature=youtu.be",
		start: 0,
		end: 0
	},
	{
		id: "https://www.youtube.com/watch?si=GWWWz5An6c8SfI4q&t=120&v=dQw4w9WgXcQ&feature=youtu.be",
		start: 1,
		end: 0
	},
	{
		id: "https://www.youtube.com/watch?si=GWWWz5An6c8SfI4q&t=120&v=dQw4w9WgXcQ&feature=youtu.be",
		start: 100,
		end: 0
	},
	{
		id: "https://www.youtube.com/watch?si=GWWWz5An6c8SfI4q&t=120&v=dQw4w9WgXcQ&feature=youtu.be",
		start: 130,
		end: 0
	},
	{
		id: "https://www.youtube.com/watch?si=GWWWz5An6c8SfI4q&t=120&v=dQw4w9WgXcQ&feature=youtu.be",
		start: 120,
		end: 0
	},
	{
		id: "https://www.youtube.com/watch?si=GWWWz5An6c8SfI4q&t=120&v=dQw4w9WgXcQ&feature=youtu.be",
		start: '1:50',
		end: 0
	},
	{
		id: "https://www.youtube.com/watch?si=GWWWz5An6c8SfI4q&t=120&v=dQw4w9WgXcQ&feature=youtu.be",
		start: '2:00',
		end: 0
	},
	{
		id: "https://www.youtube.com/watch?si=GWWWz5An6c8SfI4q&t=120&v=dQw4w9WgXcQ&feature=youtu.be",
		start: '2:10',
		end: 0
	},
	{
		id: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=120s",
		start: 0,
		end: 0
	},
	{
		id: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=120s",
		start: 1,
		end: 0
	},
	{
		id: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=120s",
		start: 100,
		end: 0
	},
	{
		id: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=120s",
		start: 130,
		end: 0
	},
	{
		id: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=120s",
		start: 120,
		end: 0
	},
	{
		id: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=120s",
		start: "1:50",
		end: 0
	},
	{
		id: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=120s",
		start: '2:00',
		end: 0
	},
	{
		id: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=120s",
		start: "2:10",
		end: 0
	},
	{
		id: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=120s",
		start: 0,
		end: 0
	},
	{
		id: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=120s",
		start: 0,
		end: 0
	},
	{
		id: "영상ID",
		start: 0,
		end: 0
	},
	{
		id: "영상ID",
		start: 0,
		end: 0
	},
	{
		id: "영상ID",
		start: 0,
		end: 0
	},
	{
		id: "영상ID",
		start: 0,
		end: 0
	},
	{
		id: "영상ID",
		start: 0,
		end: 0
	},
	{
		id: "영상ID",
		start: 0,
		end: 0
	},
	{
		id: "영상ID",
		start: 0,
		end: 0
	},
	{
		id: "영상ID",
		start: 0,
		end: 0
	},
	{
		id: "영상ID",
		start: 0,
		end: 0
	},
]