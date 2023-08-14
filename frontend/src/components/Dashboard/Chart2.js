import React, { useEffect, useState } from "react";
import {Line} from 'react-chartjs-2';
import { Chart as ChartJS } from "chart.js/auto";




const Chart2 = () => {
    const [set1last, setSet1last] = useState("0")
    const [set2last, setSet2last] = useState("0")
    const [set3last, setSet3last] = useState("0")

    const [data, setData] = useState({
      datasets: [
        { 
          label: "Angajati Prezenti", 
          data: [],
          borderColor: '#60A5FF88',
          tension: 0.3,
          borderWidth: 2
        },
        { 
          label: "Scanari", 
          data: [],
          borderColor: '#66FF80aa',
          tension: 0.3,
          borderWidth: 3
        },
        { 
          label: "Intarzieri", 
          data: [],
          borderColor: '#ff668a',
          tension: 0.3,
          borderWidth: 3
        },
      ]
    })
    

    const obj = {
        data: [
          {
            id: 18416,
            stamp: '1667983251243',
            userspresent: 1,
            userstotal: 0,
            scancount: 4,
            latecount: 10,
            overtimecount: 1
          },
          {
            id: 18417,
            stamp: '1667983256932',
            userspresent: 1,
            userstotal: 0,
            scancount: 4,
            latecount: 10,
            overtimecount: 1
          },
          {
            id: 18418,
            stamp: '1667983851254',
            userspresent: 1,
            userstotal: 0,
            scancount: 4,
            latecount: 14,
            overtimecount: 1
          },
          {
            id: 18419,
            stamp: '1667983856926',
            userspresent: 1,
            userstotal: 0,
            scancount: 4,
            latecount: 14,
            overtimecount: 0
          },
          {
            id: 18420,
            stamp: '1667984451254',
            userspresent: 1,
            userstotal: 0,
            scancount: 4,
            latecount: 14,
            overtimecount: 1
          },
          {
            id: 18421,
            stamp: '1667984456930',
            userspresent: 1,
            userstotal: 0,
            scancount: 4,
            latecount: 14,
            overtimecount: 1
          },
          {
            id: 18422,
            stamp: '1667985051257',
            userspresent: 1,
            userstotal: 0,
            scancount: 4,
            latecount: 14,
            overtimecount: 1
          },
          {
            id: 18423,
            stamp: '1667985056938',
            userspresent: 1,
            userstotal: 0,
            scancount: 4,
            latecount: 14,
            overtimecount: 1
          },
          {
            id: 18424,
            stamp: '1667985191803',
            userspresent: 1,
            userstotal: 0,
            scancount: 4,
            latecount: 14,
            overtimecount: 1
          },
          {
            id: 18425,
            stamp: '1667985225254',
            userspresent: 1,
            userstotal: 0,
            scancount: 4,
            latecount: 14,
            overtimecount: 1
          },
          {
            id: 18426,
            stamp: '1667985249253',
            userspresent: 1,
            userstotal: 0,
            scancount: 4,
            latecount: 14,
            overtimecount: 1
          }
        ],
        start: 1667944800000,
        end: 1668031200000,
        error: ''
    }

    // console.log(obj.data);
    
    
    function formattimeshort(stamp)
    {  
        var d=new Date(stamp);
        return (("0"+d.getHours()).slice(-2))+":"+(("0"+d.getMinutes()).slice(-2));
    }

    function processgraphdata(obj)
    {   
      var set1=[],set2=[],set3=[],set4=[],set5=[];
      obj.forEach((elem) => {
          var offset=new Date().getTimezoneOffset()*60000;
          var stamp=formattimeshort(parseInt(elem.stamp));//new Date(parseInt(elem.stamp)-offset).toISOString().split('.')[0].split('T')[1].slice(0,-3)
          set1.push({y:elem.userspresent,x:stamp});
          set2.push({y:elem.userstotal,x:stamp});
          set3.push({y:elem.scancount,x:stamp});
          set4.push({y:elem.latecount,x:stamp});
          set5.push({y:elem.overtimecount,x:stamp});
      });
      console.log(set1);
      if(obj.length>0)
      {   
        setSet1last(obj[obj.length-1].userspresent);
        setSet2last(obj[obj.length-1].userstotal);
        setSet3last(obj[obj.length-1].scancount);
      }
      

      var data = {
          datasets: 
          [
            { 
              label: "Angajati Prezenti", 
              data: set1,
              borderColor: '#60A5FF88',
              tension: 0.3,
              borderWidth: 2
            },
            { 
              label: "Scanari", 
              data: set3,
              borderColor: '#66FF80aa',
              // backgroundColor: ['rgba(77, 255, 77,0.3)'],
              // fill: true,
              tension: 0.3,
              borderWidth: 3
            },
            { 
              label: "Intarzieri", 
              data: set4,
              borderColor: '#ff668a',
              // backgroundColor: ['rgba(77, 255, 77,0.3)'],
              // fill: true,
              tension: 0.3,
              borderWidth: 3
            },
          ]
      };


      var options = {
          responsive: true,
          maintainAspectRatio: false,
          // interaction: {  intersect: false},
          scales: {
              y: {beginAtZero: true},
              x: { type: 'time', min: '00:00:00',max: '23:59:00',}
          }
      }
      
      return data;
    }

    useEffect(() => {
        setData(processgraphdata(obj.data));
        console.log(data);
      }, []);
    

    const styles = {
        fontFamily: "sans-serif",
        textAlign: "center"
    };




    return (
      <>
        <div style={styles}>
          <Line data={data}/>
        </div>
      </>
    );
}

export default Chart2;


