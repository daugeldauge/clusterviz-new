require 'open3'
require 'json'
require 'sinatra'
require 'sinatra/contrib'
require 'sinatra/base'
require 'timeout'
require 'neography'
require 'set'

def get_all_nodes
  nodes = []
  $neo.execute_query("MATCH (n) RETURN n")['data'].each do |node|
    nodes[node[0]['metadata']['id']] = node[0]['data']
  end
  nodes
end

configure do
  puts 'before starts'
  $neo = Neography::Rest.new('http://graphit.parallel.ru:7474')
  $nodes = get_all_nodes()
  puts 'before ends'
end

def error_page msg
  erb :error, :locals => {:msg => msg}
end

def get_roots(type)
  query = $neo.execute_query("MATCH (n) WHERE (n)-[:#{type}]->() AND NOT ()-[:#{type}]->(n) RETURN n")
  query['data'].map do |node|
    node[0]['metadata']['id']
  end
end

def get_id(url)
  url.gsub(/.*\D/, '').to_i
end

def get_levels(type, levels)
  roots = get_roots(type)
  rels = []
  rels[0] = roots.map{ |root| $neo.get_node_relationships(root, 'out', 'TYPE_0') }.reduce(:+)
  (0...levels).each do |i|
    rels[i + 1] = []
    rels[i].each do |rel|
      target = get_id rel['end']
      rels[i + 1] += $neo.get_node_relationships(target, 'out', 'TYPE_0')
      #puts "#{i + 1} #{rels[i + 1].size}"
    end
    #puts "#{i} #{rels[i].size}"
  end
  rels
end

get '/nodes/:id' do
  content_type :json
  $nodes[params[:id].to_i].to_json
end

get '/neo' do
  levels = get_levels('TYPE_0', 1)
  rels = levels.reduce(:+)
  links = rels.map do |rel|
    {
      source: get_id(rel['start']),
      target: get_id(rel['end']),
      type: rel['data']['type']
    }
  end

  i = 0
  nodes = Set.new
  links.each do |link|
    nodes.add(link[:source])
    nodes.add(link[:target])
  end

  nodes = nodes.to_a
  nodes.map! do |node|
    {id: node, size: 10, type: $nodes[node]['type']}
  end
  
  content_type :json
  {nodes: nodes, links: links}.to_json
end

get '/' do
  clusters = %w(cheb lom lab)
  dot_info = {}
  clusters.each do |cluster|
    file = cluster + '.dot'
    stat = File.stat file
    info = '<strong>Last updated:</strong> ' + stat.ctime.strftime('%d.%m.%Y %H:%M:%S') + '<br>'
    info += '<strong>Size:</strong> ' + '%.2f' % [stat.size.to_f / (1024 * 1024)] + ' MiB<br>'
    #info += "IP: 0.0.0.0"
    dot_info[cluster.to_sym] = info
  end
  erb :start
end
