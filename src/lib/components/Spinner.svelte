<script lang="ts">
    interface Props {
        scale?: number
        bg?: string
        barWidth?: number
    }
    
    let { scale = 1, bg = "#53503f", barWidth = 10 }: Props = $props()
</script>

<div class="spinner" style:transform={`scale(${scale})`}>
    <div class="bar1" style:background={bg} style:width={`${barWidth}%`}></div>
    <div class="bar2" style:background={bg} style:width={`${barWidth}%`}></div>
    <div class="bar3" style:background={bg} style:width={`${barWidth}%`}></div>
    <div class="bar4" style:background={bg} style:width={`${barWidth}%`}></div>
    <div class="bar5" style:background={bg} style:width={`${barWidth}%`}></div>
    <div class="bar6" style:background={bg} style:width={`${barWidth}%`}></div>
    <div class="bar7" style:background={bg} style:width={`${barWidth}%`}></div>
    <div class="bar8" style:background={bg} style:width={`${barWidth}%`}></div>
    <div class="bar9" style:background={bg} style:width={`${barWidth}%`}></div>
    <div class="bar10" style:background={bg} style:width={`${barWidth}%`}></div>
    <div class="bar11" style:background={bg} style:width={`${barWidth}%`}></div>
    <div class="bar12" style:background={bg} style:width={`${barWidth}%`}></div>
</div>

<style lang="scss">
    .spinner {
        width: 20px;
        height: 20px;
        padding: 4px;
        border-radius: 4px;
        position: relative;
    }
    
    .spinner div {
        height: 25%;
        position: absolute;
        left: 49%;
        top: 37.5%;
        opacity: 0;
        border-radius: 50px;
        animation: fade 1s linear infinite;
    }
    
    @keyframes fade {
        from {opacity: 1;}
        to {opacity: 0.25;}
    }
    
    .spinner .bar1 { transform:rotate(0deg) translate(0, -130%); animation-delay: 0s; }    
    .spinner .bar2 { transform:rotate(30deg) translate(0, -130%); animation-delay: -0.9167s; }
    .spinner .bar3 { transform:rotate(60deg) translate(0, -130%); animation-delay: -0.833s; }
    .spinner .bar4 { transform:rotate(90deg) translate(0, -130%); animation-delay: -0.7497s; }
    .spinner .bar5 { transform:rotate(120deg) translate(0, -130%); animation-delay: -0.667s; }
    .spinner .bar6 { transform:rotate(150deg) translate(0, -130%); animation-delay: -0.5837s; }
    .spinner .bar7 { transform:rotate(180deg) translate(0, -130%); animation-delay: -0.5s; }
    .spinner .bar8 { transform:rotate(210deg) translate(0, -130%); animation-delay: -0.4167s; }
    .spinner .bar9 { transform:rotate(240deg) translate(0, -130%); animation-delay: -0.333s; }
    .spinner .bar10 { transform:rotate(270deg) translate(0, -130%); animation-delay: -0.2497s; }
    .spinner .bar11 { transform:rotate(300deg) translate(0, -130%); animation-delay: -0.167s; }
    .spinner .bar12 { transform:rotate(330deg) translate(0, -130%); animation-delay: -0.0833s; }
</style>
